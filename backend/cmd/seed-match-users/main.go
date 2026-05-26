package main

// Seed UnlockEd users for testing the auto-match UI.
// For each Canvas user found, creates three UnlockEd users (no provider mapping):
//   - Exact name      → will be auto-confirmed  (score ≥ 0.90)
//   - ~2-char change  → will need review        (score 0.50–0.89)
//   - Random name     → will be unmatched       (score < 0.50)
//
// Usage (from the backend/ directory):
//   go run cmd/seed-match-users/main.go
//
// Env vars required (same as the main server):
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, APP_KEY

import (
	"UnlockEdv2/src/models"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file, using environment variables")
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=prefer",
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))

	db, err := gorm.Open(postgres.New(postgres.Config{DSN: dsn}), &gorm.Config{})
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}

	// Find first Canvas provider platform
	var provider models.ProviderPlatform
	if err := db.Where("type IN ?", []string{"canvas_cloud", "canvas_oss"}).
		Where("state = ?", "enabled").
		First(&provider).Error; err != nil {
		log.Fatalf("no enabled Canvas provider found: %v", err)
	}
	log.Printf("Using provider: %s (%s)", provider.Name, provider.BaseUrl)

	accessKey, err := decryptAccessKey(provider.AccessKey)
	if err != nil {
		log.Fatalf("decrypt access key: %v", err)
	}

	// Find first facility
	var facility models.Facility
	if err := db.First(&facility).Error; err != nil {
		log.Fatalf("no facility found: %v", err)
	}
	log.Printf("Using facility: %s (id=%d)", facility.Name, facility.ID)

	// Fetch Canvas users
	canvasUsers, err := fetchCanvasUsers(provider.BaseUrl, provider.AccountID, accessKey)
	if err != nil {
		log.Fatalf("fetch canvas users: %v", err)
	}
	if len(canvasUsers) == 0 {
		log.Fatal("no Canvas users returned — check the provider URL and access key")
	}
	log.Printf("Found %d Canvas users", len(canvasUsers))

	randomNames := [][2]string{
		{"Xavier", "Beaumont"}, {"Isabelle", "Fontaine"}, {"Thierry", "Marchand"},
		{"Nadia", "Leclair"}, {"Renaud", "Girault"}, {"Sabine", "Aubert"},
		{"Florent", "Beaulieu"}, {"Camille", "Tissot"}, {"Edouard", "Renard"},
		{"Vivienne", "Chevalier"}, {"Bastien", "Lemaitre"}, {"Colette", "Dupuis"},
	}
	randomIdx := 0

	created := 0
	for i, cu := range canvasUsers {
		if cu.NameFirst == "" && cu.NameLast == "" {
			continue
		}
		// Limit to first 5 Canvas users to keep the seed manageable
		if i >= 5 {
			break
		}

		// 1. Exact match → auto-confirmed
		exactUser := models.User{
			NameFirst:  cu.NameFirst,
			NameLast:   cu.NameLast,
			Username:   slugify(fmt.Sprintf("%s%s_exact%d", cu.NameFirst, cu.NameLast, i)),
			Email:      fmt.Sprintf("exact_%d@test.local", i),
			Role:       models.Student,
			FacilityID: facility.ID,
		}
		if err := db.Create(&exactUser).Error; err != nil {
			log.Printf("  skip exact for %s %s: %v", cu.NameFirst, cu.NameLast, err)
		} else {
			log.Printf("  ✓ exact   %s %s", cu.NameFirst, cu.NameLast)
			created++
		}

		// 2. Two-char modification of last name → ambiguous
		modLast := modifyName(cu.NameLast, 2)
		ambigUser := models.User{
			NameFirst:  cu.NameFirst,
			NameLast:   modLast,
			Username:   slugify(fmt.Sprintf("%s%s_ambig%d", cu.NameFirst, modLast, i)),
			Email:      fmt.Sprintf("ambig_%d@test.local", i),
			Role:       models.Student,
			FacilityID: facility.ID,
		}
		if err := db.Create(&ambigUser).Error; err != nil {
			log.Printf("  skip ambig for %s %s: %v", cu.NameFirst, modLast, err)
		} else {
			log.Printf("  ~ ambig   %s %s", cu.NameFirst, modLast)
			created++
		}

		// 3. Completely different name → unmatched
		if randomIdx < len(randomNames) {
			rn := randomNames[randomIdx]
			randomIdx++
			unmatchedUser := models.User{
				NameFirst:  rn[0],
				NameLast:   rn[1],
				Username:   slugify(fmt.Sprintf("%s%s_unmatched%d", rn[0], rn[1], i)),
				Email:      fmt.Sprintf("unmatched_%d@test.local", i),
				Role:       models.Student,
				FacilityID: facility.ID,
			}
			if err := db.Create(&unmatchedUser).Error; err != nil {
				log.Printf("  skip unmatched %s %s: %v", rn[0], rn[1], err)
			} else {
				log.Printf("  ✗ unmatched %s %s", rn[0], rn[1])
				created++
			}
		}
	}

	log.Printf("\nDone — created %d UnlockEd users (no provider mappings). Open the map-users page to test matching.", created)
}

// modifyName replaces n characters at the end of name with vowel substitutions.
func modifyName(name string, n int) string {
	if len(name) <= n {
		return name + "xx"
	}
	subs := map[rune]rune{'a': 'e', 'e': 'a', 'i': 'o', 'o': 'i', 'u': 'a',
		'A': 'E', 'E': 'A', 'I': 'O', 'O': 'I', 'U': 'A'}
	runes := []rune(name)
	changed := 0
	for i := len(runes) - 1; i >= 0 && changed < n; i-- {
		if r, ok := subs[runes[i]]; ok {
			runes[i] = r
			changed++
		} else {
			// non-vowel: substitute with 'x'
			runes[i] = 'x'
			changed++
		}
	}
	return string(runes)
}

func slugify(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	result := b.String()
	if len(result) > 50 {
		result = result[:50]
	}
	return result
}

type canvasUser struct {
	NameFirst string
	NameLast  string
}

func fetchCanvasUsers(baseURL, accountID, accessKey string) ([]canvasUser, error) {
	url := fmt.Sprintf("%s/api/v1/accounts/%s/users?per_page=50", strings.TrimRight(baseURL, "/"), accountID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Canvas API returned %d: %s", resp.StatusCode, string(body))
	}

	var raw []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	var users []canvasUser
	for _, u := range raw {
		first, last := "", ""
		if sn, ok := u["sortable_name"].(string); ok && strings.Contains(sn, ",") {
			parts := strings.SplitN(sn, ",", 2)
			last = strings.TrimSpace(parts[0])
			first = strings.TrimSpace(parts[1])
		} else if name, ok := u["name"].(string); ok {
			parts := strings.Fields(name)
			if len(parts) >= 2 {
				first = parts[0]
				last = parts[len(parts)-1]
			}
		}
		if first != "" || last != "" {
			users = append(users, canvasUser{NameFirst: first, NameLast: last})
		}
	}
	return users, nil
}

func decryptAccessKey(axxKey string) (string, error) {
	appKey := os.Getenv("APP_KEY")
	hashedKey := sha256.Sum256([]byte(appKey))
	block, err := aes.NewCipher(hashedKey[:])
	if err != nil {
		return "", err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(axxKey)
	if err != nil {
		// might be stored as plaintext during local dev
		return axxKey, nil
	}
	if len(ciphertext) < aes.BlockSize {
		return axxKey, nil
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]
	//nolint:staticcheck
	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(ciphertext, ciphertext)
	decrypted := string(ciphertext)
	if !utf8.ValidString(decrypted) {
		// fallback: key might not be encrypted
		return axxKey, nil
	}
	return decrypted, nil
}
