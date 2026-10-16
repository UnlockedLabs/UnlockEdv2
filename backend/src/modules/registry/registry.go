// Package registry is the one list of feature modules. The server and the
// migrations CLI both use it, so adding a module means adding it here only.
package registry

import (
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/learningrecord"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/opencontent"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/programs"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/providerplatforms"
)

// All returns every feature module, in the order their routes and jobs are
// registered and their migrations run. Provider Platforms comes before
// Programs, because Programs uses its classes (EN-186).
func All() []module.Module {
	return []module.Module{
		providerplatforms.Module{},
		opencontent.Module{},
		programs.Module{},
		learningrecord.Module{},
	}
}
