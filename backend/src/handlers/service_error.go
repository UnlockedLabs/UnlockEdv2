package handlers

import (
	"UnlockEdv2/src/database"
	"errors"
	"fmt"
	"net/http"

	log "github.com/sirupsen/logrus"
)

type serviceError struct {
	Status     int    `json:"status"`
	Message    string `json:"msg"`
	Err        error  `json:"-"`
	Fields     log.Fields
	CustLogMsg string
}

// Can pass a DBError into this, but will only be on rare circumstances used to override status and message
func NewServiceError(err error, status int, msg string, flds log.Fields) serviceError {
	svcErr := serviceError{}
	if dbErr, ok := err.(database.DBError); ok {
		svcErr.Err = errors.Join(errors.New(dbErr.Message), dbErr.InternalErr)
	} else {
		svcErr.Err = err
	}
	svcErr.Status = status
	svcErr.Message = msg
	svcErr.Fields = flds
	return svcErr
}

// The Error method below is used for implementation purposes only so that the serviceError can be used as an error type. The Error() function is not normally called on the serviceError type.
func (svcErr serviceError) Error() string {
	return fmt.Sprintf("service error: %s", svcErr.Err.Error())
}

func (svcErr serviceError) containsFields() bool {
	return len(svcErr.Fields) > 0
}

func (svcErr serviceError) log(r *http.Request) {
	if svcErr.containsFields() {
		log.WithFields(svcErr.Fields).Error("Error occurred on endpoint ", r.Method, " ", r.URL.Path, " Error: ", svcErr.Err)
	} else {
		log.Error("Error occurred on endpoint ", r.Method, " ", r.URL.Path, " Error: ", svcErr.Err)
	}
}

func newBadRequestServiceError(err error, msg string, flds log.Fields) serviceError { //default is BadRequest
	return NewServiceError(err, http.StatusBadRequest, msg, flds)
}

func newResponseServiceError(err error, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusInternalServerError, "error writing response", flds)
}

func newJSONReqBodyServiceError(err error, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusBadRequest, "error reading json request", flds)
}

func newUnauthorizedServiceError(flds log.Fields) serviceError {
	return NewServiceError(errors.New("user unauthorized"), http.StatusUnauthorized, "Unauthorized", flds)
}

func newInvalidIdServiceError(err error, idName string, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusBadRequest, fmt.Sprintf("invalid %s", idName), flds)
}

func newInvalidQueryParamServiceError(err error, paramName string, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusBadRequest, fmt.Sprintf("invalid %s parameter", paramName), flds)
}

func newForbiddenServiceError(err error, msg string, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusForbidden, msg, flds)
}

func newCreateRequestServiceError(err error, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusInternalServerError, "error creating request", flds)
}

func newMarshallingBodyServiceError(err error, flds log.Fields) serviceError {
	return NewServiceError(err, http.StatusInternalServerError, "error marshalling body", flds)
}

func newInternalServerServiceError(err error, msg string, flds log.Fields) serviceError {
	return serviceError{
		Message: msg,
		Status:  http.StatusInternalServerError,
		Fields:  flds,
		Err:     err,
	}
}

func newDatabaseServiceError(err error, flds log.Fields) serviceError {
	svcErr := serviceError{}
	if dbErr, ok := err.(database.DBError); ok {
		svcErr.Message = dbErr.Message
		svcErr.Status = dbErr.Status
		svcErr.Err = dbErr.InternalErr
	} else {
		svcErr.Message = err.Error()
		svcErr.Status = http.StatusInternalServerError
		svcErr.Err = err
	}
	svcErr.Fields = flds
	return svcErr
}
