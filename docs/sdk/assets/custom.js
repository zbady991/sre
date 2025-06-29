async function waitNavLoaded() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const nav = document.querySelector('.tsd-small-nested-navigation');
            if (nav && nav.textContent.length > 20) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const nav = document.querySelector('.tsd-small-nested-navigation');

    nav.style.display = 'none';
    await waitNavLoaded();

    var group = {};

    document.querySelectorAll('.tsd-small-nested-navigation li').forEach((li) => {
        const span = li.querySelector('span');
        if (!span) return;
        const text = span.textContent.trim();
        const parts = text.split('\\');
        if (parts.length > 1) {
            if (!group[parts[0]]) group[parts[0]] = [];
            group[parts[0]].push(li);
            li.remove();
            span.innerHTML = parts[1];
        }
    });

    var li = document.createElement('li');

    for (let g in group) {
        var details = `
<details class="tsd-accordion" data-has-instance="true">
<summary class="tsd-accordion-summary" data-key="${g}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
<use href="#icon-chevronDown">
</use>
</svg>

<a href="#">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="tsd-kind-icon" aria-label="Namespace">
<use href="#icon-4">
</use>
</svg>
<span>${g}</span>
</a>
</summary>

<div class="tsd-accordion-details">
<ul class="tsd-nested-navigation">
${group[g].map((li) => li.outerHTML).join('\n')}
</ul>
</div>
</details>
`;

        li.innerHTML += details;
    }

    document.querySelector('.tsd-small-nested-navigation').appendChild(li);
    nav.style.display = 'block';

    nav.querySelectorAll('.current').forEach((li) => {
        li.closest('.tsd-accordion').open = true;
    });
});
