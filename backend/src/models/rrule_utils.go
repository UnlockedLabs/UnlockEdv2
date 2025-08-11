package models

import (
	"strings"
	"time"

	"github.com/teambition/rrule-go"
)

func ReplaceOrAddUntilDate(rRule, untilDate string) string {
	lines := strings.Split(rRule, "\n")
	for i, line := range lines {
		if strings.Contains(line, "RRULE:") {
			parts := strings.Split(line, ";")
			var newParts []string
			for _, part := range parts {
				if !strings.HasPrefix(part, "UNTIL=") {
					newParts = append(newParts, part)
				}
			}
			newParts = append(newParts, "UNTIL="+untilDate)
			lines[i] = strings.Join(newParts, ";")
			break
		}
	}
	return strings.Join(lines, "\n")
}

func GetUntilDateFromRule(rRule string) string {
	opts, err := rrule.StrToROption(rRule)
	if err == nil && !opts.Until.IsZero() {
		return FormatTimeForRRule(opts.Until)
	}
	return ""
}

func FormatTimeForRRule(t time.Time) string {
	return t.UTC().Format("20060102T150405Z")
}

func ClampUntilToEndOfDay(rRule string, day time.Time) string {
	endOfDay := time.Date(day.Year(), day.Month(), day.Day(), 23, 59, 59, 0, time.UTC)
	endOfDay = endOfDay.Truncate(time.Second)
	untilDate := FormatTimeForRRule(endOfDay)
	return ReplaceOrAddUntilDate(rRule, untilDate)
}
