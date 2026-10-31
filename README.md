# Osidian Day One Calendar

An Obsidian desktop/mobile calendar for journal notes stored in `Day-One/YYYY/MM/YYYY-MM-DD HHmmss.md`.

This structure was created once Imported from DayOne using [Day One Importer](https://github.com/marcdonald/obsidian-day-one-importer)

## Features

- Apple Calendar-inspired year (12 months), month and day views.
- Day indicators for existing entries and a chronological list of all entries on a date.
- Creates timestamped Markdown notes in existing folder structure, including past dates.
- Supports built-in Templates placeholders: `{{date}}`, `{{date:YYYY-MM-DD}}`, `{{time}}`, `{{time:HH:mm}}`, `{{title}}`.
- Obsidian theme-aware, responsive for mobile, ribbon icon and command.
- Does not rename or alter existing notes.

## Install (manual)

1. Copy `manifest.json`, `main.js`, and `styles.css` to `<vault>/.obsidian/plugins/day-one-calendar/`.
2. In Obsidian, enable **Settings → Community plugins → Day One Calendar** (you may need to restart/reload Obsidian).
3. Open **Day One Calendar** from the ribbon or command palette.
4. Under **Settings → Day One Calendar**, enter your existing template path, e.g. `Templates/Journal.md`.

For mobile, sync the `.obsidian/plugins/day-one-calendar/` directory to the mobile vault (or copy these files there) and enable the plugin in Obsidian mobile.

## Notes

- The plugin reads only Markdown files matching the exact path/filename structure. Month folders are two digits (`01` through `12`).
- Calendar weeks begin on **Sunday**.
- For backdated entries, the selected calendar date is used in the filename; the time is the device's current local time.
- Template substitution is implemented locally for standard built-in Templates placeholders. It does **not** run Templater scripts or invoke Obsidian's internal template insertion command. For `{{date}}` and `{{time}}`, it attempts to use the built-in Templates plugin's configured default formats, falling back to plugin settings.
- The plugin has not been tested on a physical iOS/Android device; validate in a test vault before relying on it.

## Build from source

```sh
npm install
npm run check
npm run build
```

## License

MIT

## Template selection (v1.2.0)

When creating an entry, choose a Markdown template from your Obsidian Templates folder, or choose a blank entry. Configure the folder under Day One Calendar settings. The plugin uses standard built-in Templates date/time/title placeholders.

## v1.2.1

Fix iOS new-entry creation when a parent folder exists with different capitalization or the vault index has not refreshed yet. Folder creation now uses the mobile-compatible vault adapter and preserves the resolved folder path.
