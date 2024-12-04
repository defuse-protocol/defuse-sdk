#!/bin/bash -e
#
# Development hot-reload utility that overrides package files in target project.
#
# Directly updates files in node_modules instead of using yarn link to avoid:
# - Dependency duplication
# - Module resolution conflicts  
# - Package version mismatches
# Only essential files (dist/ and package.json) are linked while preserving
# the target project's dependency tree.
#
# Important Note:
# If you add new dependency to this package, you need to manually
# install (copy-paste) it to the `$target_project/node_modules`.
#

this_package_name="@defuse-protocol/defuse-sdk"
target_project="../defuse-frontend"
node_modules_package_folder="$target_project/node_modules/$this_package_name"
hrm_package_folder="$target_project/tmp/$this_package_name"

#
# We place this package inside the target project to enable dependency
# resolution taking place within the target project.
#
# We choose hardlinks over symlinks for the very same reason, otherwise
# dependencies would be resolved from this package's original location.
#
# We place this package inside other than `node_modules` folder to enable
# Hot Module Replacement (HMR) in the target project. Otherwise watchers
# ignore changes in `node_modules`.
#
echo "Creating hardlink to $hrm_package_folder"
rm -rf "$hrm_package_folder"
mkdir -p "$hrm_package_folder/dist"

ln ./dist/* "$hrm_package_folder/dist"
ln ./package.json "$hrm_package_folder"

#
# We create a symlink to this package in the target project's `node_modules`
# to activate overriding.
#
echo "Creating symlink to $node_modules_package_folder/dist"
rm -rf "$node_modules_package_folder/dist"
rm -f "$node_modules_package_folder/package.json"
mkdir -p "$node_modules_package_folder"

ln -s $(realpath "$hrm_package_folder/dist") "$node_modules_package_folder/dist"
ln -s $(realpath "$hrm_package_folder/package.json") "$node_modules_package_folder"

echo "
Package linked successfully to $target_project 🚀

To revert, run:
  rm -rf $node_modules_package_folder $hrm_package_folder
  cd $target_project
  yarn install --check-files
"