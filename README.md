<p align="center"><img src=https://github.com/user-attachments/assets/16ca67e4-b7ec-430b-82c5-65042506797d/></p>

<hr></hr>

This is the ISeeTV project. It was created due to the lack of dockerized IPTV clients. The spirit of the project is "ease" - meaning:
- Easy to navigate
- Easy to deploy
- Easy to contribute

## Planned Features:
### v1.0.0
<table style="width: 100%; border-collapse: collapse; text-align: center;">
  <thead>
    <tr>
      <th style="padding: 10px; white-space: nowrap;">Milestone</th>
      <th style="padding: 10px; white-space: nowrap;">Complete</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 10px; white-space: nowrap;">
        <a href="https://github.com/Jacob-Lasky/ISeeTV/milestone/1" target="_blank">
          v1.0.0 Misc. Tasks
        </a>
      </td>
      <td style="padding: 10px; white-space: nowrap;">
        <img src="https://img.shields.io/github/milestones/progress-percent/Jacob-Lasky/ISeeTV/1?label=" alt="Progress">
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; white-space: nowrap;">
        <a href="https://github.com/Jacob-Lasky/ISeeTV/milestone/2" target="_blank">
          EPG Parsing
        </a>
      </td>
      <td style="padding: 10px; white-space: nowrap;">
        <img src="https://img.shields.io/github/milestones/progress-percent/Jacob-Lasky/ISeeTV/6?label=" alt="Progress">
      </td>
    </tr>
  </tbody>
</table>

### v2.0.0
<table style="width: 100%; border-collapse: collapse; text-align: center;">
  <thead>
    <tr>
      <th style="padding: 10px; white-space: nowrap;">Milestone</th>
      <th style="padding: 10px; white-space: nowrap;">Complete</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 10px; white-space: nowrap;">
        <a href="https://github.com/Jacob-Lasky/ISeeTV/milestone/1" target="_blank">
          v2.0.0 Misc. Tasks
        </a>
      </td>
      <td style="padding: 10px; white-space: nowrap;">
        <img src="https://img.shields.io/github/milestones/progress-percent/Jacob-Lasky/ISeeTV/6?label=" alt="Progress">
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; white-space: nowrap;">
        <a href="https://github.com/Jacob-Lasky/ISeeTV/milestone/2" target="_blank">
          User Management
        </a>
      </td>
      <td style="padding: 10px; white-space: nowrap;">
        <img src="https://img.shields.io/github/milestones/progress-percent/Jacob-Lasky/ISeeTV/2?label=" alt="Progress">
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; white-space: nowrap;">
        <a href="https://github.com/Jacob-Lasky/ISeeTV/milestone/3" target="_blank">
          DVR Capabilities
        </a>
      </td>
      <td style="padding: 10px; white-space: nowrap;">
        <img src="https://img.shields.io/github/milestones/progress-percent/Jacob-Lasky/ISeeTV/3?label=" alt="Progress">
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; white-space: nowrap;">
        <a href="https://github.com/Jacob-Lasky/ISeeTV/milestone/5" target="_blank">
          xTeVe-like filtering and restreaming
        </a>
      </td>
      <td style="padding: 10px; white-space: nowrap;">
        <img src="https://img.shields.io/github/milestones/progress-percent/Jacob-Lasky/ISeeTV/5?label=" alt="Progress">
      </td>
    </tr>
  </tbody>
</table>

## UI:
![image](https://github.com/user-attachments/assets/30fffa09-fbca-45a5-a6ef-4c3c6ff2907b)
- Three channel tabs: All, Favorites and Recent
- Collapsable channel list
- Search box
- Settings gear to bring up the settings modal
- Toggleable channel numbers
-   Channel search appears when channel numbers are toggled

## Settings Modal:
![image](https://github.com/user-attachments/assets/56c695d2-434d-4109-9be3-8f4717bb367f)
- Provide ISeeTV with an M3U link and (optionally) with an EPG
-   Includes a manual refresh button
- Change the update interval
- Set the M3U to update on app-startup
- Change the theme to light, dark or system (default)

## Running the project manually

1. Run `docker compose up` to start the containers.
2. Open `http://localhost:1313` in your browser.

## FAQ | Development | Feature Requests:
If you're thinking about contributing to this repo in any way, I want you to! I welcome all ideas, feedback, questions and PRs. I had never used React before starting this project and recognize how difficult it is to jump into something new. I want us all to support each other as we build cool things together.
- General Development Guidelines
  - Ask tons of questions
  - Keep code tested
  - Update the README
