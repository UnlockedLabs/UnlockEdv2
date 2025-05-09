package src

func FilterMap[T any](ss []T, test func(T) bool) (ret []T) {
	for _, s := range ss {
		if test(s) {
			ret = append(ret, s)
		}
	}
	return
}

func IterMap[T any, E any](fun func(T) E, arr []T) []E {
	applied := []E{}
	for _, item := range arr {
		applied = append(applied, fun(item))
	}
	return applied
}
