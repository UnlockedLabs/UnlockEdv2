git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/heads/ | while read branch; do
  echo "$branch:" $(git log --all -1 --format="%h %s" $branch -- provider-middleware/kolibri.go)
done
