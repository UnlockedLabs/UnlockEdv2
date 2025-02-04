package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
)

// sLog is a wrapper around the log.Fields map and is implemented by the handleError method, this struct is not intended to be accessed directly and was created to make adding key/values and logging more efficient.
type sLog struct{ f logrus.Fields }

func (slog sLog) info(args ...interface{}) {
	logrus.WithFields(slog.f).Info(args...)
}

func (slog sLog) infof(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Infof(format, args...)
}

func (slog sLog) debug(args ...interface{}) {
	logrus.WithFields(slog.f).Debug(args...)
}

func (slog sLog) debugf(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Debugf(format, args...)
}

func (slog sLog) warn(args ...interface{}) {
	logrus.WithFields(slog.f).Warn(args...)
}

func (slog sLog) warnf(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Warnf(format, args...)
}

func (slog sLog) error(args ...interface{}) {
	logrus.WithFields(slog.f).Error(args...)
}

func (slog sLog) errorf(format string, args ...interface{}) {
	logrus.WithFields(slog.f).Errorf(format, args...)
}

func (slog *sLog) add(key string, value interface{}) {
	slog.f[key] = value
}

func (srv *Server) getQueryContext(r *http.Request) models.QueryContext {
	var facilityID, userID uint
	claims := r.Context().Value(ClaimsKey).(*Claims)
	f, err := strconv.Atoi(r.URL.Query().Get("facility_id"))
	if err != nil {
		facilityID = claims.FacilityID
	} else {
		facilityID = uint(f)
	}
	u, err := strconv.Atoi(r.URL.Query().Get("user_id"))
	if err != nil {
		userID = claims.UserID
	} else {
		userID = uint(u)
	}
	page, perPage := srv.getPaginationInfo(r)
	orderBy := strings.ToLower(r.URL.Query().Get("order_by"))
	order := strings.ToLower(r.URL.Query().Get("order"))
	if order == "" && orderBy != "" {
		orderBySplit := strings.Fields(orderBy)
		if len(orderBySplit) > 1 {
			orderBy = orderBySplit[0]
			order = orderBySplit[1]
		}
	}
	if order != "asc" && order != "desc" {
		order = "asc"
	}
	search := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("search")))
	tags := r.URL.Query()["tags"]
	all := r.URL.Query().Get("all") == "true"
	return models.QueryContext{
		Page:       page,
		PerPage:    perPage,
		FacilityID: uint(facilityID),
		UserID:     uint(userID),
		OrderBy:    orderBy,
		Order:      order,
		IsAdmin:    claims.isAdmin(),
		Search:     search,
		Tags:       tags,
		All:        all,
	}
}
