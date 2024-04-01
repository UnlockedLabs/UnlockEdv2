find ./app ./database -type f -name "*.php" -print0 | while IFS= read -r -d $'\0' file; do
    if ! grep -qP '^<\?php\s+declare\(strict_types=1\);' "$file"; then
        awk '
        BEGIN {p=1}
        /^<\?php$/ {print; if(p) { print "declare(strict_types=1);"; p=0} next}
        {if(p && /^<\?php\s+/) {print "declare(strict_types=1);"; p=0} print}
        ' "$file" >temp_file.php && mv temp_file.php "$file"
    fi
done
