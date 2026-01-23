# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-23

### Added

#### Weather-Based UOTD System
- Automatic weather checking at configured UOTD schedule times
- 30-90 minute forecast window for accurate recommendations (weather when students will actually be outside)
- Sunrise/sunset data for twilight detection
- Smart accessory recommendation engine with configurable rules:
  - **Rain/Storm** → Wet Weather Gear (OCP, ECWS, Water source)
  - **Below 40°F** → Fleece Jacket + Watch Cap
  - **40-45°F** → Fleece Jacket + Patrol Cap
  - **Twilight/Nighttime** → Reflective Belt + Light Source (auto-added)
  - **High Wind (>20mph)** → Secured headgear note
- Weather labels on UOTD cards (Wet, Snow, Cold, Cool, Hot)
- Meal slot labels (Breakfast, Lunch, Dinner)

#### Push Notifications
- Single unified notification when UOTD posts are created
- Format: `🔴 BETA | UOTD Breakfast Wet Posted at 0600 on Jan 23 2026`
- Includes uniform name, items, and auto-added accessories with reasons

#### UI Improvements
- Red BETA label on UOTD cards
- Warning banner: "Use Williams' Signal posts as source of truth!"
- Weather condition icons on UOTD cards
- Both current and forecast weather stored in recommendations

#### Duplicate Prevention
- Weather system takes precedence when rules are configured
- `uotdScheduler` defers to weather system to prevent duplicate posts
- Defense-in-depth duplicate checks in approval workflow

#### Infrastructure
- Personnel roster import foundation (CSV/Excel)
- Cleaning details management
- CQ (Charge of Quarters) tracker foundation

### Fixed
- Duplicate UOTD notifications issue resolved
- Weather recommendations now use forecast data instead of current conditions

### Changed
- Renamed "PT Belt" to "Reflective Belt" in accessory rules
- Renamed "Flashlight" to "Light Source" in accessory rules
- Notification format updated to match card display

---

## [Unreleased]

### Planned
- Personnel roster management UI
- Cleaning details assignment and tracking
- CQ status board with DA Form generation
- Remove BETA label when system is validated
