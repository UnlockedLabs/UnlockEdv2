package integration

import (
	"testing"

	"UnlockEdv2/src/handlers"
)

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name        string
		filename    string
		want        string
		expectError bool
	}{
		{
			name:        "Valid JPG filename",
			filename:    "photo.jpg",
			want:        "photo.jpg",
			expectError: false,
		},
		{
			name:        "Valid PNG with uppercase extension",
			filename:    "IMAGE.PNG",
			want:        "IMAGE.PNG",
			expectError: false,
		},
		{
			name:        "Path traversal attempt (fails due to no extension)",
			filename:    "../../../etc/passwd",
			want:        "",
			expectError: true,
		},
		{
			name:        "Path traversal with valid extension gets sanitized to base",
			filename:    "../../malicious.jpg",
			want:        "malicious.jpg",
			expectError: false,
		},
		{
			name:        "Absolute path",
			filename:    "/etc/passwd",
			want:        "",
			expectError: true,
		},
		{
			name:        "Null byte injection",
			filename:    "valid.jpg\x00.exe",
			want:        "",
			expectError: true,
		},
		{
			name:        "Invalid extension - exe",
			filename:    "malware.exe",
			want:        "",
			expectError: true,
		},
		{
			name:        "Invalid extension - sh",
			filename:    "script.sh",
			want:        "",
			expectError: true,
		},
		{
			name:        "No extension",
			filename:    "noextension",
			want:        "",
			expectError: true,
		},
		{
			name:        "Empty filename",
			filename:    "",
			want:        "",
			expectError: true,
		},
		{
			name:        "Dot file",
			filename:    ".",
			want:        "",
			expectError: true,
		},
		{
			name:        "Double dot",
			filename:    "..",
			want:        "",
			expectError: true,
		},
		{
			name:        "Valid WebP",
			filename:    "modern.webp",
			want:        "modern.webp",
			expectError: false,
		},
		{
			name:        "Valid GIF",
			filename:    "animation.gif",
			want:        "animation.gif",
			expectError: false,
		},
		{
			name:        "Mixed case extension",
			filename:    "photo.JpEg",
			want:        "photo.JpEg",
			expectError: false,
		},
		{
			name:        "Long filename within limit",
			filename:    "this_is_a_very_long_filename_but_still_valid_and_under_255_characters.jpg",
			want:        "this_is_a_very_long_filename_but_still_valid_and_under_255_characters.jpg",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := handlers.SanitizeFilename(tt.filename)
			if tt.expectError {
				if err == nil {
					t.Errorf("sanitizeFilename() expected error but got none for input: %q", tt.filename)
				}
			} else {
				if err != nil {
					t.Errorf("sanitizeFilename() unexpected error: %v for input: %q", err, tt.filename)
				}
				if got != tt.want {
					t.Errorf("sanitizeFilename() = %q, want %q", got, tt.want)
				}
			}
		})
	}
}

func TestValidatePathContainment(t *testing.T) {
	tests := []struct {
		name        string
		basePath    string
		filename    string
		expectError bool
	}{
		{
			name:        "Valid file in base path",
			basePath:    "/tmp/uploads",
			filename:    "photo.jpg",
			expectError: false,
		},
		{
			name:        "Path traversal blocked",
			basePath:    "/tmp/uploads",
			filename:    "../../../etc/passwd",
			expectError: true,
		},
		{
			name:        "Simple parent directory attempt",
			basePath:    "/tmp/uploads",
			filename:    "../sensitive.jpg",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := handlers.ValidatePathContainment(tt.basePath, tt.filename)
			if tt.expectError {
				if err == nil {
					t.Errorf("validatePathContainment() expected error but got none for basePath=%q, filename=%q", tt.basePath, tt.filename)
				}
			} else {
				if err != nil {
					t.Errorf("validatePathContainment() unexpected error: %v", err)
				}
				if got == "" {
					t.Errorf("validatePathContainment() returned empty path")
				}
			}
		})
	}
}

func TestAllowedExtensions(t *testing.T) {
	expectedExtensions := []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}

	if len(handlers.AllowedExtensions) != len(expectedExtensions) {
		t.Errorf("AllowedExtensions has %d entries, expected %d", len(handlers.AllowedExtensions), len(expectedExtensions))
	}

	for _, ext := range expectedExtensions {
		if !handlers.AllowedExtensions[ext] {
			t.Errorf("Expected extension %q to be allowed but it's not in AllowedExtensions map", ext)
		}
	}
}
