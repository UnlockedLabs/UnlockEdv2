package integration

import (
	"UnlockEdv2/src/handlers"
	"testing"
)

func TestNextPageURL(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   string
	}{
		{
			name:   "standard next link",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; rel="next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "next among multiple relations",
			header: `<https://canvas.example.com/api/v1/courses?page=1>; rel="prev", <https://canvas.example.com/api/v1/courses?page=3>; rel="next", <https://canvas.example.com/api/v1/courses?page=10>; rel="last"`,
			want:   "https://canvas.example.com/api/v1/courses?page=3",
		},
		{
			name:   "no next relation",
			header: `<https://canvas.example.com/api/v1/courses?page=10>; rel="last"`,
			want:   "",
		},
		{
			name:   "empty header",
			header: "",
			want:   "",
		},
		{
			name:   "case-insensitive rel name",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; REL="next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "case-insensitive rel value",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; rel="Next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "extra whitespace around semicolon and equals",
			header: `<https://canvas.example.com/api/v1/courses?page=2> ;  rel = "next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "rel before additional params",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; rel="next"; title="Next Page"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "rel after other params (attribute order variation)",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; title="Next Page"; rel="next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "URL containing a comma",
			header: `<https://canvas.example.com/api/v1/courses?foo=a,b&page=2>; rel="next"`,
			want:   "https://canvas.example.com/api/v1/courses?foo=a,b&page=2",
		},
		{
			name:   "URL containing a semicolon (percent-encoded)",
			header: `<https://canvas.example.com/api/v1/courses?filter=a%3Bb>; rel="next"`,
			want:   "https://canvas.example.com/api/v1/courses?filter=a%3Bb",
		},
		{
			name:   "multiple space-separated rel tokens including next",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; rel="alternate next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "unquoted rel value",
			header: `<https://canvas.example.com/api/v1/courses?page=2>; rel=next`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
		{
			name:   "first entry has no next, second does",
			header: `<https://canvas.example.com/api/v1/courses?page=1>; rel="current", <https://canvas.example.com/api/v1/courses?page=2>; rel="next"`,
			want:   "https://canvas.example.com/api/v1/courses?page=2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := handlers.NextPageURL(tt.header)
			if got != tt.want {
				t.Errorf("NextPageURL(%q)\n  got  %q\n  want %q", tt.header, got, tt.want)
			}
		})
	}
}
