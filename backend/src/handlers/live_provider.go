package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// A live provider is one whose courses are read over HTTP on request and projected
// as synthetic programs and classes, rather than synced into our tables. Canvas is
// the first; the seams here exist so a second provider can differ in the two ways
// that actually matter -- how it authenticates, and how it pages -- without
// duplicating the handler layer.
//
// Synthetic IDs are deliberately not part of this: encodeCanvasClassID and friends
// key off provider_platforms.id, never the provider type, so every live provider
// already gets a disjoint ID range for free.

// providerTransport is the per-provider HTTP seam. Canvas authenticates with a
// bearer token and pages via RFC-5988 Link headers; other providers set a
// different header and page by other means.
type providerTransport interface {
	// authorize applies whatever credential scheme the provider uses.
	authorize(req *http.Request, provider *models.ProviderPlatform)

	// fetchAll retrieves every page starting at startURL and returns the combined
	// records. max limits the total returned; 0 means fetch everything.
	fetchAll(ctx context.Context, provider *models.ProviderPlatform, startURL string, max int) ([]map[string]interface{}, error)

	// fetchOne retrieves a single JSON object, for endpoints that return a bare
	// record rather than a collection.
	fetchOne(ctx context.Context, provider *models.ProviderPlatform, url string) (map[string]interface{}, error)
}

// canvasTransport implements providerTransport for Canvas.
type canvasTransport struct {
	srv *Server
}

func (t canvasTransport) authorize(req *http.Request, provider *models.ProviderPlatform) {
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")
}

func (t canvasTransport) fetchAll(ctx context.Context, provider *models.ProviderPlatform, startURL string, max int) ([]map[string]interface{}, error) {
	return t.srv.fetchAllCanvasPages(ctx, provider, startURL, max)
}

func (t canvasTransport) fetchOne(ctx context.Context, provider *models.ProviderPlatform, url string) (map[string]interface{}, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	t.authorize(req, provider)
	resp, err := t.srv.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("canvas returned %d", resp.StatusCode)
	}
	var record map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&record); err != nil {
		return nil, err
	}
	return record, nil
}

// maxRawCourseID is the largest provider course ID the synthetic class ID
// encoding can carry. encodeCanvasClassID packs the course into the low six
// digits, so an ID at or above this overflows into the provider field and the
// class would silently be attributed to a different provider. Callers skip such
// courses rather than emitting a corrupt ID.
const maxRawCourseID = 999_999

// courseIDFitsEncoding reports whether a provider course ID can be encoded
// without colliding with another provider's range.
func courseIDFitsEncoding(rawCourseID uint) bool {
	return rawCourseID <= maxRawCourseID
}

// liveCourseList is what a provider reports for one read of its course listing.
type liveCourseList struct {
	// Courses are the records that parsed successfully.
	Courses []liveCourse
	// Timezones maps a raw course ID to its IANA timezone, for the courses where
	// the provider reports one.
	Timezones map[uint]string
	// Total is how many course records the provider returned, including any that
	// could not be parsed. Class counts are reported against this, not against
	// len(Courses), so a malformed record still shows up in the total.
	Total int
}

// LiveProgramProvider reads a provider's courses on request. Implementations are
// obtained through newLiveProgramProvider, which fails for provider types that
// are not read this way.
type LiveProgramProvider interface {
	// ListCourses returns every course this provider platform exposes.
	ListCourses(ctx context.Context) (liveCourseList, error)

	// ListCourseEnrollees returns the provider's own user IDs for the students in
	// a course. Only called when a liveCourse did not already carry them.
	ListCourseEnrollees(ctx context.Context, rawCourseID uint) ([]string, error)

	// GetCourse returns one course by the provider's own course ID, along with
	// its IANA timezone where the provider reports one.
	GetCourse(ctx context.Context, rawCourseID uint) (liveCourse, string, error)
}

// courseEnrollees returns the enrollee IDs for a course, using the ones the
// listing already supplied when the provider reports them inline and falling
// back to a per-course request when it does not.
func courseEnrollees(ctx context.Context, reader LiveProgramProvider, course liveCourse) ([]string, error) {
	if course.enrolleeIDs != nil {
		return course.enrolleeIDs, nil
	}
	return reader.ListCourseEnrollees(ctx, course.rawID)
}

// canvasProvider is the Canvas implementation of LiveProgramProvider.
type canvasProvider struct {
	srv       *Server
	provider  *models.ProviderPlatform
	transport providerTransport
}

func (p canvasProvider) ListCourses(ctx context.Context) (liveCourseList, error) {
	raw, err := p.transport.fetchAll(ctx, p.provider, canvasAccountCoursesURL(p.provider), 0)
	if err != nil {
		return liveCourseList{}, fmt.Errorf("canvas API error for provider %d: %w", p.provider.ID, err)
	}
	now := time.Now()
	courses := make([]liveCourse, 0, len(raw))
	for _, record := range raw {
		course, ok := parseCanvasCourse(record, p.provider.ID, now)
		if !ok {
			continue
		}
		courses = append(courses, course)
	}
	return liveCourseList{
		Courses:   courses,
		Timezones: buildCourseTimezoneMap(raw),
		Total:     len(raw),
	}, nil
}

// GetCourse reads the single-course endpoint. Canvas reports a per-course
// timezone, which the class detail page uses to render schedule times.
func (p canvasProvider) GetCourse(ctx context.Context, rawCourseID uint) (liveCourse, string, error) {
	record, err := p.transport.fetchOne(ctx, p.provider, canvasCourseURL(p.provider, rawCourseID))
	if err != nil {
		return liveCourse{}, "", fmt.Errorf("fetching canvas course %d: %w", rawCourseID, err)
	}
	course, ok := parseCanvasCourse(record, p.provider.ID, time.Now())
	if !ok {
		return liveCourse{}, "", fmt.Errorf("canvas course %d could not be parsed", rawCourseID)
	}
	timezone, _ := record["time_zone"].(string)
	return course, timezone, nil
}

func (p canvasProvider) ListCourseEnrollees(ctx context.Context, rawCourseID uint) ([]string, error) {
	return p.srv.fetchCanvasCourseEnrolleeIDs(p.provider, rawCourseID)
}

// newLiveProgramProvider returns the live reader for a provider platform, or an
// error when the type is not read live.
func (srv *Server) newLiveProgramProvider(provider *models.ProviderPlatform) (LiveProgramProvider, error) {
	transport, err := srv.transportFor(provider)
	if err != nil {
		return nil, err
	}
	if provider.Type == models.EssentialEd {
		return essentialEdProvider{srv: srv, provider: provider, transport: transport}, nil
	}
	return canvasProvider{srv: srv, provider: provider, transport: transport}, nil
}

// canvasAccountCoursesURL is the account course listing every Canvas read path
// starts from. It was copied inline in seven places before this existed.
func canvasAccountCoursesURL(provider *models.ProviderPlatform) string {
	return provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
}

// canvasCourseURL is the single-course endpoint.
func canvasCourseURL(provider *models.ProviderPlatform, rawCourseID uint) string {
	return fmt.Sprintf("%s/api/v1/courses/%d", provider.BaseUrl, rawCourseID)
}

// liveUserLister is implemented by live providers that can list their own user
// accounts directly. Providers that do not implement it (Canvas) continue to be
// served by provider-middleware over HTTP.
type liveUserLister interface {
	ListUsers(ctx context.Context) ([]models.ImportUser, error)
}

// liveUserListerFor returns the provider's own user lister when it has one.
func (srv *Server) liveUserListerFor(provider *models.ProviderPlatform) (liveUserLister, bool) {
	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return nil, false
	}
	lister, ok := reader.(liveUserLister)
	return lister, ok
}

// allProviderUsers returns every user the provider knows about, mapped or not.
// listProviderUsers is the counterpart that returns only the unmapped ones.
func (srv *Server) allProviderUsers(ctx context.Context, provider *models.ProviderPlatform) ([]models.ImportUser, error) {
	if lister, ok := srv.liveUserListerFor(provider); ok {
		return lister.ListUsers(ctx)
	}
	service, err := src.GetProviderService(provider, srv.Client)
	if err != nil {
		return nil, err
	}
	return service.GetAllUsers()
}

// liveUserCourseLister is implemented by live providers that can report the
// courses one of their users is enrolled in. Canvas is not: it has a dedicated
// per-user endpoint, served by fetchCanvasCoursesForUser.
type liveUserCourseLister interface {
	ListUserCourses(ctx context.Context, externalUserID string) ([]liveCourse, error)
}

// unmappedProviderUsers drops provider users that already have a
// ProviderUserMapping, so the matching screen only offers new ones.
func (srv *Server) unmappedProviderUsers(providerID uint, users []models.ImportUser) ([]models.ImportUser, error) {
	mapped, err := srv.Db.GetMappedUsersExternalIDs(int(providerID))
	if err != nil {
		return nil, err
	}
	taken := make(map[string]struct{}, len(mapped))
	for _, externalID := range mapped {
		taken[externalID] = struct{}{}
	}
	unmapped := make([]models.ImportUser, 0, len(users))
	for _, user := range users {
		if _, already := taken[user.ExternalUserID]; already {
			continue
		}
		unmapped = append(unmapped, user)
	}
	return unmapped, nil
}

// providerCourseEnrolleeIDs returns the provider's own student IDs for a course,
// dispatching on provider type. This is what the enrollee counters use, so they
// work for any live provider rather than only Canvas.
func (srv *Server) providerCourseEnrolleeIDs(provider *models.ProviderPlatform, rawCourseID uint) ([]string, error) {
	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return nil, err
	}
	return reader.ListCourseEnrollees(context.Background(), rawCourseID)
}

// providerSourceLabel is the value the frontend uses to tell where a synthetic
// program came from. It is sent as ProgramsOverviewTable.Source.
func providerSourceLabel(p *models.ProviderPlatform) string {
	if p.Type == models.EssentialEd {
		return "essential_ed"
	}
	return "canvas"
}

// providerDisplayName is the human-readable provider name used in descriptions.
func providerDisplayName(p *models.ProviderPlatform) string {
	if p.Type == models.EssentialEd {
		return "Essential Education"
	}
	return "Canvas"
}

// isLiveProgramProvider reports whether this provider platform is read live and
// projected as synthetic programs. Prefer this over isCanvasProvider at call
// sites that only mean "is this one of the live providers".
func isLiveProgramProvider(p *models.ProviderPlatform) bool {
	return isCanvasProvider(p) || p.Type == models.EssentialEd
}

// transportFor returns the HTTP seam for a provider platform, or an error when
// the type is not a live provider.
func (srv *Server) transportFor(provider *models.ProviderPlatform) (providerTransport, error) {
	switch {
	case isCanvasProvider(provider):
		return canvasTransport{srv: srv}, nil
	case provider.Type == models.EssentialEd:
		return essentialEdTransport{srv: srv}, nil
	}
	return nil, fmt.Errorf("provider %d (%s) is not a live program provider", provider.ID, provider.Type)
}
