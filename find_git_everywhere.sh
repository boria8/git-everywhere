#!/usr/bin/env bash

set -u
set -o pipefail

needle="${1:-}"

if [ -z "$needle" ]; then
    echo "Usage: $0 <search_string>"
    exit 1
fi

tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t gitfind)"
trap 'rm -rf "$tmp_dir"' EXIT

print_sep()
{
    echo "======================================================================"
}

print_title()
{
    print_sep
    echo "$1"
    print_sep
}

safe_name()
{
    echo "$1" | tr '/:{}^ ' '_'
}

tree_cache_file()
{
    local tree="$1"
    echo "$tmp_dir/tree_$(safe_name "$tree").paths"
}

tree_done_file()
{
    local tree="$1"
    echo "$tmp_dir/tree_$(safe_name "$tree").done"
}

commit_seen_file()
{
    local commit="$1"
    echo "$tmp_dir/commit_$(safe_name "$commit").seen"
}

commit_via_file()
{
    local commit="$1"
    echo "$tmp_dir/commit_$(safe_name "$commit").via"
}

commit_commitish_file()
{
    local commit="$1"
    echo "$tmp_dir/commit_$(safe_name "$commit").commitish"
}

scan_tree_once()
{
    local tree="$1"
    local out_file
    local done_file

    out_file="$(tree_cache_file "$tree")"
    done_file="$(tree_done_file "$tree")"

    if [ -f "$done_file" ]; then
        return 0
    fi

    if git ls-tree -r --name-only "$tree" 2>/dev/null | grep -F "$needle" > "$out_file"; then
        :
    else
        : > "$out_file"
    fi

    touch "$done_file"
}

tree_has_match()
{
    local tree="$1"
    local out_file

    out_file="$(tree_cache_file "$tree")"
    [ -s "$out_file" ]
}

add_found_via()
{
    local commit="$1"
    local via="$2"
    local via_file
    local current

    via_file="$(commit_via_file "$commit")"

    if [ -f "$via_file" ]; then
        current="$(cat "$via_file")"
        case ",$current," in
            *",$via,"*)
                ;;
            *)
                echo "$current, $via" > "$via_file"
                ;;
        esac
    else
        echo "$via" > "$via_file"
    fi
}

mark_commit_seen()
{
    local commit="$1"
    local via="$2"
    local commitish="$3"

    touch "$(commit_seen_file "$commit")"
    add_found_via "$commit" "$via"

    if [ ! -f "$(commit_commitish_file "$commit")" ]; then
        echo "$commitish" > "$(commit_commitish_file "$commit")"
    fi
}

commit_already_seen()
{
    local commit="$1"
    [ -f "$(commit_seen_file "$commit")" ]
}

print_copy_paste_commands()
{
    local commit="$1"
    local change_id="$2"
    local first_path="$3"
    local short

    short="$(git rev-parse --short "$commit" 2>/dev/null || echo "$commit")"

    echo "Copy/paste commands:"
    echo "  git show --stat $commit"
    echo "  git show --name-status $commit"
    echo "  git show --format=fuller $commit"
    echo "  git switch -c rescue-$short $commit"
    echo "  git checkout -b rescue-$short $commit"
    echo "  git branch rescue-$short $commit"
    echo "  git cherry-pick $commit"
    echo "  git log --graph --decorate --oneline $commit^..$commit"

    if [ -n "$change_id" ]; then
        echo "  git log --all --grep='$change_id'"
    fi

    if [ -n "$first_path" ]; then
        echo "  git checkout $commit -- \"$first_path\""
        echo "  git restore --source $commit -- \"$first_path\""
    fi

    echo
}

print_commit_details()
{
    local commit="$1"
    local tree="$2"
    local out_file
    local subject
    local author_name
    local author_email
    local author_date
    local commit_date
    local parents
    local refs_pointing
    local branches_containing
    local changed_files
    local first_path
    local change_id
    local via
    local first_commitish
    local reachable_from_head

    out_file="$(tree_cache_file "$tree")"

    subject="$(git show --no-patch --format='%s' "$commit" 2>/dev/null || true)"
    author_name="$(git show --no-patch --format='%an' "$commit" 2>/dev/null || true)"
    author_email="$(git show --no-patch --format='%ae' "$commit" 2>/dev/null || true)"
    author_date="$(git show --no-patch --format='%ad' --date=iso-strict "$commit" 2>/dev/null || true)"
    commit_date="$(git show --no-patch --format='%cd' --date=iso-strict "$commit" 2>/dev/null || true)"
    parents="$(git show --no-patch --format='%P' "$commit" 2>/dev/null || true)"
    refs_pointing="$(git for-each-ref --format='%(refname:short)' --points-at="$commit" 2>/dev/null || true)"
    branches_containing="$(git branch -a --contains "$commit" 2>/dev/null | sed 's/^..//' || true)"
    changed_files="$(git show --name-status --format='' "$commit" 2>/dev/null || true)"
    first_path="$(head -n 1 "$out_file" 2>/dev/null || true)"
    change_id="$(git show -s --format=%B "$commit" 2>/dev/null | sed -n 's/^Change-Id:[[:space:]]*//p' | head -n 1)"
    via="$(cat "$(commit_via_file "$commit")" 2>/dev/null || true)"
    first_commitish="$(cat "$(commit_commitish_file "$commit")" 2>/dev/null || true)"

    if git merge-base --is-ancestor "$commit" HEAD 2>/dev/null; then
        reachable_from_head="yes"
    else
        reachable_from_head="no"
    fi

    print_title "MATCHED COMMIT"
    echo "Search string      : $needle"
    echo "Found via          : ${via:-<unknown>}"
    echo "First commitish    : ${first_commitish:-$commit}"
    echo "Commit full SHA    : $commit"
    echo "Commit short SHA   : $(git rev-parse --short "$commit" 2>/dev/null || echo "$commit")"
    echo "Subject            : $subject"
    echo "Change-Id          : ${change_id:-<none>}"
    echo "Author             : $author_name <$author_email>"
    echo "Author date        : $author_date"
    echo "Commit date        : $commit_date"
    echo "Parents            : ${parents:-<none>}"
    echo "Reachable from HEAD: $reachable_from_head"
    echo

    echo "Refs pointing exactly to this commit:"
    if [ -n "$refs_pointing" ]; then
        echo "$refs_pointing" | sed 's/^/  - /'
    else
        echo "  <none>"
    fi
    echo

    echo "Local/remote branches containing this commit:"
    if [ -n "$branches_containing" ]; then
        echo "$branches_containing" | sed 's/^/  - /'
    else
        echo "  <none>"
    fi
    echo

    echo "Matched paths:"
    sed 's/^/  - /' "$out_file"
    echo

    echo "Files changed in this commit:"
    if [ -n "$changed_files" ]; then
        echo "$changed_files" | sed 's/^/  - /'
    else
        echo "  <no diff info>"
    fi
    echo

    print_copy_paste_commands "$commit" "$change_id" "$first_path"
}

register_commit_if_match()
{
    local via="$1"
    local commitish="$2"
    local commit
    local tree

    commit="$(git rev-parse "$commitish^{commit}" 2>/dev/null)" || return 0
    tree="$(git rev-parse "$commit^{tree}" 2>/dev/null)" || return 0

    scan_tree_once "$tree"

    if tree_has_match "$tree"; then
        mark_commit_seen "$commit" "$via" "$commitish"

        if ! commit_already_seen "$commit.printed"; then
            :
        fi
    fi
}

scan_source_stream()
{
    local via="$1"
    local commitish

    while read -r commitish; do
        [ -z "$commitish" ] && continue
        register_commit_if_match "$via" "$commitish"
    done
}

print_all_found_commits()
{
    local seen_file
    local commit
    local tree

    for seen_file in "$tmp_dir"/commit_*.seen; do
        [ -e "$seen_file" ] || continue

        commit="$(basename "$seen_file" .seen)"
        commit="${commit#commit_}"

        commit="$(echo "$commit" | tr '_' '/')"
        # restore original SHA more safely from file name is not possible with tr only for generic refs,
        # so store exact commit inside an auxiliary file instead
    done
}

# exact commit list storage
commit_list_file="$tmp_dir/commit_list.txt"
: > "$commit_list_file"

append_unique_commit()
{
    local commit="$1"

    if ! grep -Fxq "$commit" "$commit_list_file" 2>/dev/null; then
        echo "$commit" >> "$commit_list_file"
    fi
}

register_commit_if_match()
{
    local via="$1"
    local commitish="$2"
    local commit
    local tree

    commit="$(git rev-parse "$commitish^{commit}" 2>/dev/null)" || return 0
    tree="$(git rev-parse "$commit^{tree}" 2>/dev/null)" || return 0

    scan_tree_once "$tree"

    if tree_has_match "$tree"; then
        mark_commit_seen "$commit" "$via" "$commitish"
        append_unique_commit "$commit"
    fi
}

scan_dangling_trees()
{
    local tree
    local out_file

    git fsck --full --no-reflogs 2>/dev/null | awk '/dangling tree/ {print $3}' | sort -u | while read -r tree; do
        [ -z "$tree" ] && continue

        scan_tree_once "$tree"

        if tree_has_match "$tree"; then
            out_file="$(tree_cache_file "$tree")"

            print_title "MATCHED DANGLING TREE"
            echo "Search string      : $needle"
            echo "Tree SHA           : $tree"
            echo
            echo "Matched paths:"
            sed 's/^/  - /' "$out_file"
            echo
            echo "Copy/paste commands:"
            echo "  git ls-tree -r $tree"
            echo "  git archive $tree | tar -x"
            echo
        fi
    done
}

echo "Searching for path/name containing: $needle"
echo

print_title "SCANNING REACHABLE COMMITS"
git rev-list --all 2>/dev/null | sort -u | scan_source_stream "reachable"

print_title "SCANNING REFLOG COMMITS"
git reflog --all --format='%H' 2>/dev/null | sort -u | scan_source_stream "reflog"

print_title "SCANNING STASH"
git stash list 2>/dev/null | cut -d: -f1 | while read -r stash_ref; do
    [ -z "$stash_ref" ] && continue
    register_commit_if_match "stash-main" "$stash_ref"
    register_commit_if_match "stash-index" "$stash_ref^2"
    register_commit_if_match "stash-untracked" "$stash_ref^3"
done

print_title "SCANNING DANGLING COMMITS"
git fsck --full --no-reflogs 2>/dev/null | awk '/dangling commit/ {print $3}' | sort -u | scan_source_stream "dangling"

print_title "RESULTS"

if [ -s "$commit_list_file" ]; then
    while read -r commit; do
        [ -z "$commit" ] && continue
        tree="$(git rev-parse "$commit^{tree}" 2>/dev/null || true)"
        [ -z "$tree" ] && continue
        print_commit_details "$commit" "$tree"
    done < "$commit_list_file"
else
    echo "No matching commits found."
    echo
fi

print_title "SCANNING DANGLING TREES"
scan_dangling_trees

print_title "SUMMARY"
echo "Unique matching commits: $(wc -l < "$commit_list_file" | tr -d ' ')"
echo
echo "Done."