declare var chrome: any;

chrome.devtools.panels.create(
  "CaptureExt",
  "", // Icon path
  "panel.html",
  (panel: any) => {
    console.log("Panel created");
  }
);