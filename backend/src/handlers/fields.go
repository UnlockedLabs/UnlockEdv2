package handlers

import log "github.com/sirupsen/logrus"

// LogFields is a wrapper around the log.Fields map and is implemented by the HandleError method, this struct is not intended to be accessed directly and was created to make adding key/values and logging them more efficient.
type LogFields struct{ f log.Fields }

func (fields LogFields) info(args ...interface{}) {
	log.WithFields(fields.f).Info(args...)
}

func (fields LogFields) infof(format string, args ...interface{}) {
	log.WithFields(fields.f).Infof(format, args...)
}

func (fields LogFields) debug(args ...interface{}) {
	log.WithFields(fields.f).Debug(args...)
}

func (fields LogFields) debugf(format string, args ...interface{}) {
	log.WithFields(fields.f).Debugf(format, args...)
}

func (fields LogFields) warn(args ...interface{}) {
	log.WithFields(fields.f).Warn(args...)
}

func (fields LogFields) warnf(format string, args ...interface{}) {
	log.WithFields(fields.f).Warnf(format, args...)
}

func (fields LogFields) error(args ...interface{}) {
	log.WithFields(fields.f).Error(args...)
}

func (fields LogFields) errorf(format string, args ...interface{}) {
	log.WithFields(fields.f).Errorf(format, args...)
}

func (fields LogFields) add(key string, value interface{}) {
	fields.f[key] = value
}
