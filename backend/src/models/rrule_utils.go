package models

import (
	"strings"
	"time"
)

func ReplaceOrAddUntilDate(rRule, untilDate string) string {
	rRuleParts := strings.Split(rRule, ";")
	untilExists := false
	for i, part := range rRuleParts {
		if strings.HasPrefix(part, "UNTIL=") {
			rRuleParts[i] = "UNTIL=" + untilDate
			untilExists = true
			break
		}
	}
	if !untilExists {
		rRuleParts = append(rRuleParts, "UNTIL="+untilDate)
	}
	return strings.Join(rRuleParts, ";")
}

func GetUntilDateFromRule(rRule string) string {
	for _, rRulePart := range strings.Split(rRule, ";") {
		if strings.HasPrefix(rRulePart, "UNTIL=") {
			return strings.TrimPrefix(rRulePart, "UNTIL=")
		}
	}
	return ""
}

func FormatTimeForRRule(t time.Time) string {
	return t.UTC().Format("20060102T150405Z")
}
