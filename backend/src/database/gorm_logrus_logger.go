package database

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// callerFileLine returns the app frame that issued the query, skipping GORM and this logger.
func callerFileLine() string {
	for i := 2; i < 18; i++ {
		_, file, line, ok := runtime.Caller(i)
		if !ok {
			continue
		}
		if strings.Contains(file, "gorm.io/gorm") {
			continue
		}
		if strings.Contains(file, "gorm_logrus_logger.go") {
			continue
		}
		return file + ":" + strconv.Itoa(line)
	}
	return ""
}

func compactSQLLog(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func formatSQLTrace(prefix string, elapsed time.Duration, rows int64, sql string) string {
	rowVal := any(rows)
	if rows == -1 {
		rowVal = "-"
	}
	if prefix == "" {
		return compactSQLLog(fmt.Sprintf(
			"%s [%.3fms] [rows:%v] %s",
			callerFileLine(), float64(elapsed.Nanoseconds())/1e6, rowVal, sql,
		))
	}
	return compactSQLLog(fmt.Sprintf(
		"%s %s [%.3fms] [rows:%v] %s",
		callerFileLine(), prefix, float64(elapsed.Nanoseconds())/1e6, rowVal, sql,
	))
}

// logrusGormLogger adapts GORM's logger to logrus so slow SQL uses Warn and errors use Error.
type logrusGormLogger struct {
	gormlogger.Config
}

func newLogrusGormLogger(cfg gormlogger.Config) gormlogger.Interface {
	return &logrusGormLogger{Config: cfg}
}

func (l *logrusGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	copied := *l
	copied.LogLevel = level
	return &copied
}

func (l *logrusGormLogger) Info(_ context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Info {
		logrus.Infof("%s %s", callerFileLine(), fmt.Sprintf(msg, data...))
	}
}

func (l *logrusGormLogger) Warn(_ context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Warn {
		logrus.Warnf("%s %s", callerFileLine(), fmt.Sprintf(msg, data...))
	}
}

func (l *logrusGormLogger) Error(_ context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Error {
		logrus.Errorf("%s %s", callerFileLine(), fmt.Sprintf(msg, data...))
	}
}

func (l *logrusGormLogger) Trace(_ context.Context, begin time.Time, fc func() (string, int64), err error) {
	if l.LogLevel <= gormlogger.Silent {
		return
	}

	elapsed := time.Since(begin)
	switch {
	case err != nil && l.LogLevel >= gormlogger.Error && (!errors.Is(err, gorm.ErrRecordNotFound) || !l.IgnoreRecordNotFoundError):
		sql, rows := fc()
		logrus.Error(formatSQLTrace(err.Error(), elapsed, rows, sql))
	case elapsed > l.SlowThreshold && l.SlowThreshold != 0 && l.LogLevel >= gormlogger.Warn:
		sql, rows := fc()
		logrus.Warn(formatSQLTrace(fmt.Sprintf("SLOW SQL >= %v", l.SlowThreshold), elapsed, rows, sql))
	case l.LogLevel == gormlogger.Info:
		sql, rows := fc()
		logrus.Info(formatSQLTrace("", elapsed, rows, sql))
	}
}

// ParamsFilter enables ParameterizedQueries so bind values are not logged.
func (l *logrusGormLogger) ParamsFilter(_ context.Context, sql string, params ...interface{}) (string, []interface{}) {
	if l.ParameterizedQueries {
		return sql, nil
	}
	return sql, params
}
