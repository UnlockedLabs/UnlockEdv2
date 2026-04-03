package services

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"math"
)

type UsersService struct {
	db *database.DB
}

func NewUsersService(db *database.DB) *UsersService {
	return &UsersService{db: db}
}

func (svc *UsersService) GetWeeklyAttendanceTrend(ctx context.Context, userID, weeks int) ([]models.WeeklyAttendanceTrend, error) {
	rows, err := svc.db.GetUserWeeklyAttendanceRows(ctx, userID, weeks)
	if err != nil {
		return nil, err
	}
	trends := make([]models.WeeklyAttendanceTrend, 0, len(rows))
	for _, r := range rows {
		rate := 0.0
		if r.TotalCount > 0 {
			rate = math.Round(r.PresentCount / r.TotalCount * 100)
		}
		trends = append(trends, models.WeeklyAttendanceTrend{
			Week: fmt.Sprintf("%s %d", r.WeekStart.Format("Jan"), r.WeekStart.Day()),
			Rate: rate,
		})
	}
	return trends, nil
}
