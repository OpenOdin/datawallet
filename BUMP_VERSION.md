# How to bump Datawallet version

    1. Bump ./src/lib/types.ts `AppVersion` field to next upcoming version
    2. Update package.json to next upcoming version
    3. Update src/extension/manifest-{firefox,chrome}.json to next upcoming version
    4. Run `npm i` to update package-lock.json
    5. Update CHANGELOG.md
    6. Commit changes
    7. Tag commit with new version
    8. Push to remote with --tags
    9. Commit and push
    10. Publish releases built on GitHub to browser plugin stores
    11. Done
