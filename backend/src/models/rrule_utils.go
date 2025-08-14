package models

import "strings"

func ReplaceOrAddUntilDate(rRule, untilDate string) string {
	parts := strings.Split(rRule, ";")
	found := false
	for i, p := range parts {
		if strings.HasPrefix(p, "UNTIL=") {
			parts[i] = "UNTIL=" + untilDate
			found = true
			break
		}
	}
	if !found {
		parts = append(parts, "UNTIL="+untilDate)
	}
	return strings.Join(parts, ";")
}
