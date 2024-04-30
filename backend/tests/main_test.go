package tests

import (
	"Go-Prototype/backend/cmd/handlers"
	"os"
	"testing"
)

/*
* This is the main test file where we define a global server variable, and a TestMain
* function to run our tests. We can run our tests in parallel by using the t.Parallel()
* method at the beginning of each test function. However, in order to avoid row/table
* locks, we need to be sure to never call this method on tests which write to the database.
 */
var server *handlers.Server

func TestMain(m *testing.M) {
	server = handlers.NewServer(true)
	exitVal := m.Run()
	os.Exit(exitVal)
}
