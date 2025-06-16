const { PageEvent } = require('typedoc');

/**
 * A TypeDoc plugin that injects a custom header and forces the light theme.
 * @param {import('typedoc').Application} app The TypeDoc application.
 */
function load(app) {
    app.renderer.on(PageEvent.END, (page) => {
        // The `contents` property contains the full HTML of the page at this stage.
        // We will find the body tag and insert our content right after it.
        const bodyTag = '<body>';
        if (page.contents && page.contents.includes(bodyTag)) {
            const bodyIndex = page.contents.indexOf(bodyTag) + bodyTag.length;

            const header = `
<div class="header-submenu">
<div class="header-submenu-container">
<nav class="menu-bar" role="navigation" aria-label="Sub Navigation">
<ul>
<li><a href="/docs/agent-studio/overview/" class="">
<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#studioClip)" transform="translate(.5 -.33)" stroke="currentColor"><path clip-rule="evenodd" d="M1 7.9982c0-2.6252.0281-3.5 3.5-3.5s3.5.8748 3.5 3.5.011 3.5-3.5 3.5-3.5-.8748-3.5-3.5ZM9.334 3.8315c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333S9.334 5.5816 9.334 3.8315zM9.334 12.8315c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333s-2.3333-.5832-2.3333-2.3333z" stroke-linecap="round" stroke-linejoin="round"></path><path d="m7.2236 11.051 2 1M7.7764 6.051l2-1"></path><path d="M3 8.4982c.8649.8056 2.1521.6859 2.8225 0" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></g><defs><clipPath id="studioClip"><path fill="currentColor" transform="translate(0 .4982)" d="M0 0h16v16H0z"></path></clipPath></defs></svg>
<span>Studio</span></a></li>

<li><a href="/docs/agent-weaver/overview/" class="">
<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 4.209c0-1.1046-.895-2-2-2H4c-1.1046 0-2 .8954-2 2v5.8555c0 1.1046.8954 2 2 2h1.4413a1 1 0 0 1 .707.293l1.145 1.145a1 1 0 0 0 1.414 0l1.145-1.145a1 1 0 0 1 .707-.293H12c1.1046 0 2-.8954 2-2z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="m10.5 7.471-1 2.5-1.5-3.034-1.5 3.535-1.5-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M11.177 6.328A1.769 1.769 0 0 0 10 5.1496a1.769 1.769 0 0 0 1.177-1.1785A1.769 1.769 0 0 0 12.354 5.15 1.769 1.769 0 0 0 11.177 6.328z" fill="currentColor"></path></svg>
<span>Weaver</span></a></li>

<li><a href="/docs/agent-runtime/overview/" class="">
<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.661 3.025h4.682c1.6287 0 2.6374.884 2.6328 2.5083v4.93c0 1.6242-1.0093 2.5128-2.638 2.5128H5.661c-1.6236 0-2.6374-.9042-2.6374-2.5544V5.533c0-1.6242 1.0138-2.5083 2.6374-2.5083z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M10.6986 3.0248V2M7.999 3.025v-1.025M5.299 3.025v-1.025M5.299 12.9752V14m2.7-1.025v1.025m2.7-1.025v1.025M3.025 5.2994H2m1.025 2.7h-1.025m1.025 2.7h-1.025M12.975 10.6989h1.025m-1.025-2.7h1.025m-1.025-2.7h1.025" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path clip-rule="evenodd" d="M9.1163 5.6302h-2.23c-.7739 0-1.2572.421-1.2572 1.1948v2.33c0 .786.4833 1.2169 1.2571 1.2169h2.2275c.7765 0 1.257-.424 1.257-1.1975V6.825c0-.7738-.4785-1.1948-1.2544-1.1948z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>
<span>Runtime</span></a></li>

<li><a href="/docs/agent-deployments/overview/" class="">
<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.957 5.385a1.075 1.075 0 1 1 1.522 1.522 1.075 1.075 0 0 1-1.522-1.522Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13.247 2.346c-3.639-.247-8.129 3.112-8.612 6.892a1.248 1.248 0 0 0 .335.868l.911.911a1.248 1.248 0 0 0 .868.335c3.78-.483 7.138-4.973 6.892-8.612a.393.393 0 0 0-.394-.394Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="m10.947 9.219-.21 2.954a.677.677 0 0 1-.374.605l-1.636.818a.677.677 0 0 1-.945-.392l-.765-1.87M6.811 5.086l-2.955.19a.677.677 0 0 0-.608.37l-.829 1.63a.677.677 0 0 0 .385.948l1.864.778M4.908 12.34c-.18 1.2-1.584.976-2.5 1.114.138-.916-.078-2.312 1.121-2.493" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>
<span>Deployments</span></a></li>

<li><a href="/docs/agent-collaboration/overview/" class="">
<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.053 4.797c-.402.061-.81-.001-1.216.009C5.897 4.83 5.16 5.658 4.445 6.22c-.366.288-.878.25-1.201-.089a.98.98 0 0 1 0-1.36c.773-.808 1.456-1.559 2.504-1.983 1.454-.589 2.803-.303 4.276 0" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.054 4.816H7.26" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2.974 13.667h.596c.455 0 .738-.334.738-.807v-2.77c0-.473-.283-.807-.738-.807h-.596" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.989 9.166c-.654-.17-1.306-.305-1.988-.288-1.082.027-1.838.655-2.695 1.253" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M7.947 11.203c.402-.061.81.001 1.216-.009.94-.023 1.677-.851 2.393-1.413.366-.288.878-.25 1.201.089a.98.98 0 0 1 0 1.36c-.773.808-1.456 1.559-2.504 1.983-1.454.589-2.803.303-4.276 0" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9.916 9.174H8.74" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M7.01 6.832c.654.171 1.306.305 1.988.288 1.082-.027 1.838-.655 2.695-1.253" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13.026 2.333h-.596c-.455 0-.738.334-.738.807v2.77c0 .473.283.808.738.808h.596" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>
<span>Collaboration</span></a></li>

<li><a href="/docs/agent-templates/overview/" class="">
<svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path clip-rule="evenodd" d="M2 4.333C2 2.583 2.018 2 4.333 2S6.667 2.583 6.667 4.333c0 1.75.007 2.333-2.333 2.333S2 6.083 2 4.333zM9.334 4.333C9.334 2.583 9.352 2 11.667 2S14 2.583 14 4.333c0 1.75.007 2.333-2.333 2.333S9.334 6.083 9.334 4.333zM2 11.667c0-1.75.019-2.333 2.333-2.333S6.667 9.917 6.667 11.667C6.667 13.417 6.674 14 4.333 14S2 13.417 2 11.667zM9.334 11.667c0-1.75.019-2.333 2.333-2.333S14 9.917 14 11.667c0 1.75.007 2.333-2.333 2.333S9.334 13.417 9.334 11.667z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"></path></svg>
<span>Templates</span></a></li></ul></nav>
</div>
</div>
      `;

            const forceThemeScript = `
        <script>
          // Function to force the theme to light.
          const forceLightTheme = () => {
            if (document.documentElement.dataset.theme !== 'light') {
              document.documentElement.dataset.theme = 'light';
            }
          };

          // Set the theme immediately to prevent a flash of the wrong theme.
          forceLightTheme();

          // Create an observer to watch for changes to the data-theme attribute.
          const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              if (mutation.attributeName === 'data-theme') {
                forceLightTheme();
              }
            });
          });

          // Start observing the document element for attribute changes.
          observer.observe(document.documentElement, { attributes: true });
        </script>
      `;

            //page.contents = page.contents.slice(0, bodyIndex) + forceThemeScript + header + page.contents.slice(bodyIndex);
            page.contents = page.contents.slice(0, bodyIndex) + forceThemeScript + page.contents.slice(bodyIndex);
        }
    });
}

exports.load = load;
