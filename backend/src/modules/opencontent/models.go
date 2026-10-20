package opencontent

import (
	"encoding/xml"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/UnlockedLabs/unlocked-contracts/identity"
	"gorm.io/gorm"
)

// Open Content's tables as Go types. The JSON names are the ones core sent
// before the move (EN-192), so the frontend sees no change.

// DatabaseFields are the columns most of Open Content's tables share. The
// create and update user come from the identity.Claims in the query's context.
type DatabaseFields struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	CreateUserID *uint `json:"create_user_id"`
	UpdateUserID *uint `json:"update_user_id"`
}

func (m *DatabaseFields) BeforeCreate(tx *gorm.DB) error {
	if c, ok := identity.FromContext(tx.Statement.Context); ok {
		m.CreateUserID = &c.UserID
	}
	return nil
}

func (m *DatabaseFields) BeforeUpdate(tx *gorm.DB) error {
	if c, ok := identity.FromContext(tx.Statement.Context); ok {
		m.UpdateUserID = &c.UserID
		tx.Statement.SetColumn("update_user_id", c.UserID)
	}
	return nil
}

const (
	KolibriThumbnailUrl     string = "https://learningequality.org/static/assets/kolibri-ecosystem-logos/blob-logo.svg"
	Kiwix                   string = "Kiwix"
	KolibriDescription      string = "Kolibri provides an extensive library of educational content suitable for all learning levels."
	KiwixThumbnailURL       string = "/kiwix.jpg"
	KiwixDescription        string = "Kiwix is an offline reader that allows you to host a wide array of educational content."
	YoutubeThumbnail        string = "/youtube.png"
	Youtube                 string = "Youtube"
	YoutubeApi              string = "https://www.googleapis.com/youtube/v3/videos"
	YoutubeDescription      string = "Hand pick videos to be available to students from youtube URL's"
	HelpfulLinks            string = "HelpfulLinks"
	HelpfulLinksThumbnail   string = "/ul-logo-d.svg"
	HelpfulLinksUrl         string = ""
	HelpfulLinksDescription string = "Hand picked helpful links for users"
)

var KiwixLibraryUrl string = os.Getenv("KIWIX_SERVER_URL")

type OpenContentProvider struct {
	DatabaseFields
	Title            *string `gorm:"size:255"  json:"title"`
	Url              string  `gorm:"size:255;not null" json:"url"`
	ThumbnailUrl     *string `json:"thumbnail_url"`
	CurrentlyEnabled bool    `json:"currently_enabled"`
	Description      *string `json:"description"`

	Videos []Video `gorm:"foreignKey:OpenContentProviderID" json:"-"`
}

func (cp *OpenContentProvider) BeforeCreate(tx *gorm.DB) error {
	if err := cp.DatabaseFields.BeforeCreate(tx); err != nil {
		return err
	}
	if formatNullableString(cp.Title) == Youtube && cp.Url == "" {
		cp.Url = YoutubeApi
	}
	if cp.Url != "" && !strings.HasPrefix(cp.Url, "http") {
		cp.Url = fmt.Sprintf("https://%s", cp.Url)
	}
	return nil
}

func (OpenContentProvider) TableName() string { return "open_content_providers" }

type OpenContentActivity struct {
	ID                    int64     `gorm:"primaryKey" json:"id"`
	OpenContentProviderID uint      `gorm:"not null" json:"open_content_provider_id"`
	FacilityID            uint      `gorm:"not null" json:"facility_id"`
	UserID                uint      `gorm:"not null" json:"user_id"`
	ContentID             uint      `gorm:"not null" json:"content_id"`
	OpenContentUrlID      uint      `gorm:"not null" json:"open_content_url_id"`
	RequestTS             time.Time `gorm:"type:datetime;default:CURRENT_TIMESTAMP" json:"request_ts"`
	StopTS                time.Time `gorm:"type:datetime;default:NULL" json:"stop_ts"`

	OpenContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
}

func (OpenContentActivity) TableName() string { return "open_content_activities" }

type OpenContentFavorite struct {
	UserID                uint      `gorm:"not null" json:"user_id"`
	ContentID             uint      `gorm:"not null" json:"content_id"`
	OpenContentProviderID uint      `gorm:"not null" json:"open_content_provider_id"`
	OpenContentUrlID      *uint     `json:"open_content_url_id,omitempty"`
	Name                  *string   `json:"name,omitempty"`
	FacilityID            *uint     `json:"facility_id"`
	CreatedAt             time.Time `json:"created_at"`
}

type OpenContentUrl struct {
	ID         uint   `gorm:"primaryKey" json:"-"`
	ContentURL string `gorm:"size:255" json:"content_url"`
}

func (OpenContentUrl) TableName() string { return "open_content_urls" }

// OpenContentItem is one library, video or helpful link in a mixed list, such
// as favorites or search results.
type OpenContentItem struct {
	Title                 string `json:"title"`
	Url                   string `json:"url"`
	ThumbnailUrl          string `json:"thumbnail_url"`
	Description           string `json:"description,omitempty"`
	VisibilityStatus      *bool  `json:"visibility_status"`
	OpenContentProviderId uint   `json:"open_content_provider_id"`
	ContentId             uint   `json:"content_id"`
	ContentType           string `json:"content_type"`
	ProviderName          string `json:"provider_name,omitempty"`
	ChannelTitle          string `json:"channel_title,omitempty"`
}

type Library struct {
	DatabaseFields
	OpenContentProviderID uint    `gorm:"not null" json:"open_content_provider_id"`
	ExternalID            *string `json:"external_id"`
	Title                 string  `gorm:"size:255;not null" json:"title"`
	Language              *string `gorm:"size:255" json:"language"`
	Description           *string `json:"description"`
	Url                   string  `gorm:"not null" json:"url"`
	ThumbnailUrl          *string `json:"thumbnail_url"`
	VisibilityStatus      bool    `gorm:"->" json:"visibility_status"`

	OpenContentProvider *OpenContentProvider  `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
	Favorites           []OpenContentFavorite `gorm:"-" json:"favorites"`
}

func (Library) TableName() string { return "libraries" }

func (lib *Library) GetFacilityVisibilityStatus(facilityID uint) *FacilityVisibilityStatus {
	visibilityStatus := FacilityVisibilityStatus{
		FacilityID:            facilityID,
		OpenContentProviderID: lib.OpenContentProviderID,
		VisibilityStatus:      lib.VisibilityStatus,
		ContentID:             lib.ID,
	}
	return &visibilityStatus
}

func (lib *Library) IntoProxyPO() *LibraryProxyPO {
	proxyParams := LibraryProxyPO{
		ID:                    lib.ID,
		Path:                  lib.Url,
		BaseUrl:               lib.OpenContentProvider.Url,
		OpenContentProviderID: lib.OpenContentProvider.ID,
		VisibilityStatus:      lib.VisibilityStatus,
	}
	return &proxyParams
}

// LibraryProxyPO is what the library proxy needs to forward a request to
// Kiwix. It is cached in the library_paths bucket.
type LibraryProxyPO struct {
	ID                    uint
	OpenContentProviderID uint
	Path                  string
	BaseUrl               string
	VisibilityStatus      bool
}

type FacilityVisibilityStatus struct {
	FacilityID            uint  `gorm:"primaryKey" json:"facility_id"`
	OpenContentProviderID uint  `gorm:"primaryKey" json:"open_content_provider_id"`
	ContentID             uint  `gorm:"primaryKey" json:"content_id"`
	VisibilityStatus      bool  `gorm:"default:false;not null" json:"visibility_status"`
	CreateUserID          *uint `json:"create_user_id"`
	UpdateUserID          *uint `json:"update_user_id"`

	OpenContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
}

func (FacilityVisibilityStatus) TableName() string { return "facility_visibility_statuses" }

func (f *FacilityVisibilityStatus) BeforeCreate(tx *gorm.DB) error {
	if c, ok := identity.FromContext(tx.Statement.Context); ok {
		f.CreateUserID = &c.UserID
		tx.Statement.SetColumn("create_user_id", c.UserID)
	}
	return nil
}

func (f *FacilityVisibilityStatus) BeforeUpdate(tx *gorm.DB) error {
	if c, ok := identity.FromContext(tx.Statement.Context); ok {
		f.UpdateUserID = &c.UserID
		tx.Statement.SetColumn("update_user_id", c.UserID)
	}
	return nil
}

type VideoAvailability string

const (
	MAX_DOWNLOAD_ATTEMPTS                   = 5
	VideoAvailable        VideoAvailability = "available"
	VideoProcessing       VideoAvailability = "processing"
	VideoHasError         VideoAvailability = "has_error"
)

type Video struct {
	DatabaseFields
	ExternalID            string            `json:"external_id" gorm:"unique"`
	Url                   string            `json:"url" gorm:"unique"`
	Title                 string            `json:"title" gorm:"size:255"`
	Availability          VideoAvailability `json:"availability" gorm:"type:video_availability"`
	ChannelTitle          *string           `json:"channel_title" gorm:"size:255"`
	Duration              int               `json:"duration"`
	Description           *string           `json:"description"`
	ThumbnailUrl          *string           `json:"thumbnail_url" gorm:"size:255"`
	OpenContentProviderID uint              `json:"open_content_provider_id" gorm:"not null"`
	VisibilityStatus      bool              `gorm:"->" json:"visibility_status"`

	Provider  *OpenContentProvider   `json:"open_content_provider" gorm:"foreignKey:OpenContentProviderID"`
	Attempts  []VideoDownloadAttempt `json:"video_download_attempts" gorm:"foreignKey:VideoID"`
	Favorites []OpenContentFavorite  `json:"video_favorites" gorm:"-"`
}

func (Video) TableName() string { return "videos" }

func (video *Video) GetFacilityVisibilityStatus(facilityID uint) FacilityVisibilityStatus {
	return FacilityVisibilityStatus{
		FacilityID:            facilityID,
		OpenContentProviderID: video.OpenContentProviderID,
		VisibilityStatus:      video.VisibilityStatus,
		ContentID:             video.ID,
	}
}

func (vid *Video) GetS3KeyMp4() string {
	return fmt.Sprintf("videos/%s.mp4", vid.ExternalID)
}

func (vid *Video) GetS3KeyJson() string {
	return fmt.Sprintf("videos/%s.json", vid.ExternalID)
}

func (vid *Video) HasRecentAttempt() bool {
	if vid.Attempts == nil {
		return false
	}
	for _, attempt := range vid.Attempts {
		if attempt.CreatedAt.After(time.Now().Add(-10 * time.Minute)) {
			return true
		}
	}
	return false
}

type VideoDownloadAttempt struct {
	DatabaseFields
	VideoID      uint    `json:"video_id" gorm:"not null"`
	ErrorMessage *string `json:"error_message" gorm:"size:512"`

	Video *Video `json:"video" gorm:"foreignKey:VideoID"`
}

func (VideoDownloadAttempt) TableName() string { return "video_download_attempts" }

type HelpfulLink struct {
	DatabaseFields
	Title                 string  `gorm:"size:255;not null" json:"title"`
	Description           string  `gorm:"size:255;not null" json:"description"`
	Url                   string  `gorm:"size:255;not null" json:"url"`
	VisibilityStatus      bool    `gorm:"->" json:"visibility_status"`
	OpenContentProviderID uint    `json:"open_content_provider_id"`
	ThumbnailUrl          *string `gorm:"size:255;" json:"thumbnail_url"`
}

func (HelpfulLink) TableName() string { return "helpful_links" }

func (hl *HelpfulLink) BeforeCreate(tx *gorm.DB) error {
	if err := hl.DatabaseFields.BeforeCreate(tx); err != nil {
		return err
	}
	hl.UpdateUserID = nil

	var id int
	if hl.OpenContentProviderID == 0 {
		if err := tx.Table("open_content_providers").Select("id").Where("title = ? ", HelpfulLinks).Scan(&id).Error; err != nil {
			return err
		}
		hl.OpenContentProviderID = uint(id)
	}
	return nil
}

// Tag is a library category.
type Tag struct {
	ID   uint   `gorm:"primaryKey" json:"key"`
	Name string `gorm:"size:255;not null" json:"value"`
}

func (Tag) TableName() string { return "tags" }

type OpenContentTag struct {
	TagID                 uint `gorm:"primaryKey" json:"tag_id"`
	ContentID             uint `gorm:"primaryKey" json:"content_id"`
	OpenContentProviderID uint `gorm:"primaryKey" json:"open_content_provider_id"`
}

func (OpenContentTag) TableName() string { return "open_content_tags" }

// The Kiwix search response, and the search results built from it.

type RSS struct {
	XMLName xml.Name `xml:"rss"`
	Version string   `xml:"version,attr"`
	Channel Channel  `xml:"channel"`
}

type Channel struct {
	Title        string `xml:"title"`
	Description  string `xml:"description"`
	TotalResults string `xml:"http://a9.com/-/spec/opensearch/1.1/ totalResults"`
	StartIndex   string `xml:"http://a9.com/-/spec/opensearch/1.1/ startIndex"`
	ItemsPerPage string `xml:"http://a9.com/-/spec/opensearch/1.1/ itemsPerPage"`
	Items        []Item `xml:"item"`
}

type Item struct {
	Title       string      `xml:"title"`
	Link        string      `xml:"link"`
	Description Description `xml:"description"`
	Book        Book        `xml:"book"`
	WordCount   string      `xml:"wordCount"`
}

type Description struct {
	RawText string `xml:"-"`
}

type Book struct {
	Title string `xml:"title"`
}

type OpenContentSearchResult struct {
	Title        string             `json:"title"`
	Link         string             `json:"link"`
	Description  string             `json:"description"`
	TotalResults string             `json:"total_results"`
	StartIndex   string             `json:"start_index"`
	ItemsPerPage string             `json:"items_per_page"`
	Items        []SearchResultItem `json:"items"`
}

type SearchResultItem struct {
	OpenContentItem
	PageTitle string `json:"page_title"`
}

func (res *OpenContentSearchResult) AppendTitleSearchResults(items []OpenContentItem) {
	for _, item := range items {
		res.Items = append(res.Items,
			SearchResultItem{
				OpenContentItem: item,
				PageTitle:       item.Title,
			})
	}
}

func (rss *RSS) SerializeSearchMeta(startIndex, perPage, total int, search string) *OpenContentSearchResult {
	channel := &OpenContentSearchResult{
		Title:        fmt.Sprintf("Search: %s", search),
		Description:  "",
		TotalResults: strconv.Itoa(total),
		StartIndex:   strconv.Itoa(startIndex),
		ItemsPerPage: strconv.Itoa(perPage),
		Items:        []SearchResultItem{},
	}
	return channel
}

func (rss *RSS) SerializeSearchResults(libraries []Library) *OpenContentSearchResult {
	channel := &OpenContentSearchResult{
		Title:        rss.Channel.Title,
		Description:  rss.Channel.Description,
		TotalResults: rss.Channel.TotalResults,
		StartIndex:   rss.Channel.StartIndex,
		ItemsPerPage: rss.Channel.ItemsPerPage,
		Items:        []SearchResultItem{},
	}
	for _, item := range rss.Channel.Items {
		library := getLibrary(libraries, item.Link)
		thumbnail := ""
		if library == nil {
			continue
		} else if library.ThumbnailUrl != nil {
			thumbnail = *library.ThumbnailUrl
		}
		resultItem := SearchResultItem{
			OpenContentItem: OpenContentItem{
				ContentId:    library.ID,
				Url:          fmt.Sprintf("/api/proxy/libraries/%d%s", library.ID, item.Link),
				ThumbnailUrl: thumbnail,
				Description:  item.Description.RawText,
				Title:        item.Book.Title,
				ContentType:  "library",
			},
			PageTitle: item.Title,
		}
		channel.Items = append(channel.Items, resultItem)
	}
	return channel
}

func getLibrary(libraries []Library, link string) *Library {
	var foundLibrary *Library
	for _, library := range libraries {
		if strings.HasPrefix(link, library.Url) {
			foundLibrary = &library
			break
		}
	}
	return foundLibrary
}

// UnmarshalXML keeps the bold words in a search result's description.
func (d *Description) UnmarshalXML(dec *xml.Decoder, start xml.StartElement) error {
	var rawContent strings.Builder

	for { //just keep looping till return nil
		tok, err := dec.Token()
		if err != nil {
			return err
		}
		switch ty := tok.(type) {
		case xml.StartElement:
			if ty.Name.Local == "b" {
				var boldText string
				err = dec.DecodeElement(&boldText, &ty)
				if err != nil {
					return err
				}
				rawContent.WriteString("<b>" + boldText + "</b>") //write it back into the description, need this
			} else { //just in case another tag is found
				rawContent.WriteString("<" + ty.Name.Local + ">")
			}
		case xml.EndElement:
			if ty.Name.Local == start.Name.Local {
				d.RawText = rawContent.String()
				return nil
			}
			rawContent.WriteString("</" + ty.Name.Local + ">")
		case xml.CharData:
			rawContent.WriteString(string(ty))
		}
	}
}

func formatNullableString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func stringPtr(s string) *string {
	return &s
}

// nilIfBlank returns nil for empty or whitespace-only strings so they are
// stored as NULL.
func nilIfBlank(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}
