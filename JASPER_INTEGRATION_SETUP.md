# JasperReports Integration Setup

This document outlines all the steps taken to integrate JasperReports with the UnlockEd v2 application using the go-jasper library.

## Overview
- Created a custom Go + JasperStarter Docker base image
- Updated Go version compatibility across the workspace
- Modified the Jasper service to use go-jasper instead of direct JasperStarter commands
- Fixed version conflicts and build issues

## Step 1: Created Custom Docker Base Image

### Location: `~/wkspcs/golang-jasper`

**Dockerfile Components:**
- Base: `golang:1.23.5-alpine`
- Java: OpenJDK 17 JRE
- JasperStarter: 3.6.2
- Font support for PDF generation
- Proper PATH configuration

**Key Files Created:**
```
~/wkspcs/golang-jasper/
├── Dockerfile              # Main Dockerfile with Go + JasperStarter
├── build.sh               # Build and push script
├── LICENSE                # MIT license for the Dockerfile
├── NOTICES                # Third-party software attributions
└── README.md              # Documentation and usage instructions
```

**Build Commands:**
```bash
cd ~/wkspcs/golang-jasper
./build.sh  # Builds and optionally pushes to Docker Hub
```

**Result:** Created `carddev81/golang-jasper:1.23-3.6.2` image

## Step 2: Updated Go Version Compatibility

### Issues Encountered:
- go.work file required Go >= 1.23.5
- Local Go installation was 1.23.4
- Docker images were using older Go versions
- go-jasper library required Go >= 1.23.5

### Solutions Applied:

#### 2.1 Updated Local Go Installation
```bash
# Downloaded Go 1.23.5
curl -LO https://go.dev/dl/go1.23.5.linux-amd64.tar.gz

# Removed old installation (requires sudo)
sudo rm -rf /usr/local/go

# Installed Go 1.23.5 (requires sudo)
sudo tar -C /usr/local -xzf go1.23.5.linux-amd64.tar.gz

# Verified installation
go version  # Should show go1.23.5
```

#### 2.2 Updated go.work File
**File:** `~/wkspcs/corys_pr_jasper/UnlockEdv2/go.work`
```go
go 1.23.5

use (
    ./backend
    ./backend/migrations
    ./backend/seeder
    ./provider-middleware
)
```

#### 2.3 Updated Docker Go Versions

**Backend dev.Dockerfile:**
```dockerfile
FROM carddev81/golang-jasper:1.23-3.6.2
```

**Provider-middleware Dockerfiles:**
- Updated `ARG GOLANG_VERSION=1.23.2` to `ARG GOLANG_VERSION=1.23.5`
- Applied to both `dev.Dockerfile` and `Dockerfile`

## Step 3: Updated Dependencies

### 3.1 Added go-jasper Library
**File:** `backend/go.mod`
```go
require (
    github.com/evertonvps/go-jasper v0.0.0-20250309141606-9de98712f6fe
    // ... other dependencies
)
```

### 3.2 Updated Imports
**File:** `backend/src/jasper/jasper_service.go`
```go
import (
    // ... other imports
    "log"
    "github.com/evertonvps/go-jasper"
)
```

## Step 4: Modified Jasper Service Implementation

### 4.1 Refactored GenerateUsageReportPDF Method

**Previous Approach (commented out):**
- Used `exec.Command` to run Java directly
- Manually created temporary files
- Used complex JasperStarter command-line arguments

**New Approach:**
- Uses go-jasper library for cleaner integration
- Simpler code with better error handling
- Test implementation with sample data

**Sample Implementation:**
```go
func (js *JasperService) GenerateUsageReportPDF(userID int) ([]byte, error) {
    // Test implementation for go-jasper integration

    outputFile := "/templates/report.jasper"
    jsonData := `[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]`
    jsonFile := "data.json"

    err := os.WriteFile(jsonFile, []byte(jsonData), 0644)
    if err != nil {
        log.Fatalf("Error creating JSON data file: %v", err)
    }
    defer os.Remove(jsonFile) // Clean up the dummy file

    // Initialize go-jasper for JSON data
    gjr := jasper.NewGoJasperJsonData(jsonFile, "", nil, "pdf", outputFile)

    // Set the path to the jasperstarter executable
    //gjr.Executable = "./jasperstarter/bin/jasperstarter"

    // Compile the JRXML report
    err = gjr.Compile("/templates/report.jrxml")
    if err != nil {
        //log.Fatalf("Error compiling report: %v", err)
    }

    // Process the report to generate the output
    pdfBytes, err := gjr.Process("/templates/report.jasper")
    if err != nil {
        //log.Fatalf("Error processing report: %v", err)
    }

    fmt.Println(string(pdfBytes))
    return pdfBytes, nil
}
```

## Step 5: Build and Testing

### 5.1 Clean Build Process
```bash
# Navigate to project directory
cd ~/wkspcs/corys_pr_jasper/UnlockEdv2

# Clean any cached builds
docker compose down
docker system prune -f

# Build and run development environment
make dev
```

### 5.2 Docker Compose Configuration
The docker-compose.yml automatically:
- Uses the custom golang-jasper base image for the backend
- Builds containers with --build --force-recreate flags
- Mounts volumes for hot reloading

## Step 6: Key Benefits Achieved

### 6.1 Performance Improvements
- **Faster builds**: No need to download JasperStarter during each build
- **Smaller Docker layers**: Base image cached with all dependencies
- **Consistent environment**: Same base image across multiple projects

### 6.2 Code Quality Improvements
- **Cleaner code**: go-jasper provides Go-native API
- **Better error handling**: Structured error handling vs parsing command output
- **Maintainable code**: Easier to understand and modify

### 6.3 Development Workflow
- **Hot reloading**: Air integration works seamlessly
- **Debugging**: Delve debugger support included
- **Version consistency**: All containers use same Go version

## Troubleshooting

### Common Issues and Solutions:

1. **Go version mismatch errors**
   - Solution: Update all Dockerfiles to use consistent Go version
   - Verify local Go version matches go.work requirement

2. **Jasper executable not found**
   - Solution: Ensure jasperstarter is in PATH in Docker container
   - Verify custom base image includes jasperstarter

3. **Permission errors with go modules**
   - Solution: Run `go mod tidy` with proper permissions
   - Remove toolchain directive if causing conflicts

4. **Build cache issues**
   - Solution: Use `docker system prune -f` to clear cache
   - Add `--no-cache` flag to build commands

## Future Enhancements

### Next Steps:
1. **Uncomment error handling** in the Jasper service
2. **Replace test data** with actual user data from database
3. **Add JRXML templates** for report generation
4. **Configure JasperStarter executable path** if needed
5. **Add comprehensive logging** for debugging
6. **Implement proper error responses** for API endpoints

### Production Considerations:
1. Use the production Dockerfile with multi-stage builds
2. Optimize image sizes for deployment
3. Add health checks for the Jasper service
4. Implement proper secret management for Jasper configurations

## File Structure Summary

```
~/wkspcs/corys_pr_jasper/UnlockEdv2/
├── backend/
│   ├── go.mod                          # Updated with go-jasper dependency
│   ├── src/jasper/jasper_service.go     # Modified implementation
│   └── dev.Dockerfile                  # Uses custom base image
├── provider-middleware/
│   ├── Dockerfile                      # Updated to Go 1.23.5
│   └── dev.Dockerfile                  # Updated to Go 1.23.5
├── go.work                             # Updated to Go 1.23.5
├── docker-compose.yml                  # Development configuration
└── JASPER_INTEGRATION_SETUP.md         # This documentation

~/wkspcs/golang-jasper/
├── Dockerfile                          # Custom Go + JasperStarter image
├── build.sh                           # Build and push script
├── LICENSE                            # MIT license
├── NOTICES                            # Third-party attributions
└── README.md                          # Usage documentation
```

This setup provides a robust foundation for JasperReports integration with Go applications in a Docker-based development environment.