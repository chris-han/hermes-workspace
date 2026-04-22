const CDP = require('chrome-remote-interface');

async function getStyles() {
    let client;
    try {
        client = await CDP();
        const {Runtime} = client;

        const expression = `
            (() => {
                const results = [];
                const searchTexts = ["Welcome! Let's connect your backend", "Auto-Start Hermes Gateway"];
                
                // Search in all shadow roots
                const allElements = [document.body, ...Array.from(document.querySelectorAll('*'))];
                for (const el of allElements) {
                    const walker = document.createTreeWalker(el.shadowRoot || el, NodeFilter.SHOW_TEXT, null, false);
                    let node;
                    while(node = walker.nextNode()) {
                        const txt = node.textContent.trim();
                        for (const target of searchTexts) {
                            if (txt.includes(target)) {
                                const parent = node.parentElement || el;
                                const style = window.getComputedStyle(parent);
                                results.push({
                                    target,
                                    found: txt,
                                    color: style.color,
                                    backgroundColor: style.backgroundColor
                                });
                            }
                        }
                    }
                }
                
                if (results.length === 0) {
                   return "No text found. Document title: " + document.title + " | URL: " + window.location.href;
                }
                return results;
            })()
        `;
        const result = await Runtime.evaluate({ expression, returnByValue: true });
        console.log(JSON.stringify(result.result.value, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

getStyles();
