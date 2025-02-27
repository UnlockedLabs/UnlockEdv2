package models

import (
	"encoding/xml"
	"fmt"
	"strings"
)

type Library struct {
	DatabaseFields
	OpenContentProviderID uint    `gorm:"not null" json:"open_content_provider_id"`
	ExternalID            *string `json:"external_id"`
	Title                 string  `gorm:"size:255;not null" json:"title"`
	Language              *string `gorm:"size:255" json:"language"`
	Description           *string `json:"description"`
	Url                   string  `gorm:"not null" json:"url"`
	ThumbnailUrl          *string `json:"thumbnail_url"`
	VisibilityStatus      bool    `gorm:"default:false;not null" json:"visibility_status"`

	OpenContentProvider *OpenContentProvider  `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
	Favorites           []OpenContentFavorite `gorm:"-" json:"favorites"`
}

func (Library) TableName() string { return "libraries" }

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

type LibraryProxyPO struct {
	ID                    uint
	OpenContentProviderID uint
	Path                  string
	BaseUrl               string
	VisibilityStatus      bool
}

// Kiwix XML START here...
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

// isolates and keeps the bolded words in the description
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
