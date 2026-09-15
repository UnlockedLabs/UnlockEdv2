package handlers

import (
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

// newLiveProgramProvider returns the live reader for a provider platform, or an
// error when the type is not read live.
func (srv *Server) newLiveProgramProvider(provider *models.ProviderPlatform) (LiveProgramProvider, error) {
	transport, err := srv.transportFor(provider)
	if err != nil {
		return nil, err
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

// isLiveProgramProvider reports whether this provider platform is read live and
// projected as synthetic programs. Prefer this over isCanvasProvider at call
// sites that only mean "is this one of the live providers".
func isLiveProgramProvider(p *models.ProviderPlatform) bool {
	return isCanvasProvider(p)
}

// transportFor returns the HTTP seam for a provider platform, or an error when
// the type is not a live provider.
func (srv *Server) transportFor(provider *models.ProviderPlatform) (providerTransport, error) {
	if isCanvasProvider(provider) {
		return canvasTransport{srv: srv}, nil
	}
	return nil, fmt.Errorf("provider %d (%s) is not a live program provider", provider.ID, provider.Type)
}
