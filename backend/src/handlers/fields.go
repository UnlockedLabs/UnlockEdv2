package handlers

import log "github.com/sirupsen/logrus"

// sLog is a wrapper around the log.Fields map and is implemented by the handleError method, this struct is not intended to be accessed directly and was created to make adding key/values and logging more efficient.
type sLog struct{ f log.Fields }

func (slog sLog) info(args ...interface{}) {
	log.WithFields(slog.f).Info(args...)
}

func (slog sLog) infof(format string, args ...interface{}) {
	log.WithFields(slog.f).Infof(format, args...)
}

func (slog sLog) debug(args ...interface{}) {
	log.WithFields(slog.f).Debug(args...)
}

func (slog sLog) debugf(format string, args ...interface{}) {
	log.WithFields(slog.f).Debugf(format, args...)
}

func (slog sLog) warn(args ...interface{}) {
	log.WithFields(slog.f).Warn(args...)
}

func (slog sLog) warnf(format string, args ...interface{}) {
	log.WithFields(slog.f).Warnf(format, args...)
}

func (slog sLog) error(args ...interface{}) {
	log.WithFields(slog.f).Error(args...)
}

func (slog sLog) errorf(format string, args ...interface{}) {
	log.WithFields(slog.f).Errorf(format, args...)
}

func (slog sLog) print(args ...interface{}) {
	log.WithFields(slog.f).Print(args...)
}

func (slog sLog) printf(format string, args ...interface{}) {
	log.WithFields(slog.f).Printf(format, args...)
}

func (slog sLog) add(key string, value interface{}) {
	slog.f[key] = value
}
