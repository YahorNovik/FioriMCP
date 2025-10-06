const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const STATE_PATH = path.resolve(process.cwd(), '.pw-state');
const ALL_JSON = path.resolve(process.cwd(), 'all.json');

function loadAll() {
	if (!fs.existsSync(ALL_JSON)) throw new Error('all.json not found. Run extract-all first.');
	return JSON.parse(fs.readFileSync(ALL_JSON, 'utf-8'));
}

async function ensureStarted(state) {
	if (state.context && !state.context.isClosed()) return;
	state.context = await chromium.launchPersistentContext(STATE_PATH, { headless: false });
	state.page = state.context.pages()[0] || await state.context.newPage();
	state.page.setDefaultTimeout(600000);
	state.page.setDefaultNavigationTimeout(600000);
}

async function cmd_start(state, url) {
	if (!url) throw new Error('Missing URL. Set $env:URL or pass start <url>');
	await ensureStarted(state);
	await state.page.goto(url, { waitUntil: 'domcontentloaded' });
	await state.page.waitForFunction(() => {
		const w = window;
		return !!(w.sap && w.sap.ui?.getCore?.() && w.sap.ui.getCore().isInitialized?.());
	});
	console.log('started');
}

async function cmd_go(state) {
	await state.page.evaluate(() => {
		try {
			const go = document.getElementById("sap.nw.core.feap.odatav4::ZZYNC_YNTRAVEL_DBList--fe::FilterBar::ZZYNC_YNTRAVEL_DB-btnSearch");
			if (go) {
				const ctrl = window.sap?.ui?.getCore?.().byId(go.id);
				if (ctrl && typeof ctrl.firePress === 'function') ctrl.firePress(); else go.click();
			}
		} catch (e) { /* ignore */ }
	});
	// Wait a moment for the table to refresh with new data
	await state.page.waitForTimeout(2000);
	await state.page.waitForSelector("table[id$='-innerTable-listUl'] tbody tr");
	// Check if we have "No data found" message
	const hasNoDataMessage = await state.page.evaluate(() => {
		const noDataTitle = document.querySelector('.sapMIllustratedMessageMainContent .sapMTitle span');
		return noDataTitle && noDataTitle.textContent.includes('No data');
	});
	
	if (hasNoDataMessage) {
		console.log(JSON.stringify({ rows: [], rowCount: 0, message: "No data found" }, null, 2));
		return;
	}
	
	// Wait for actual data to load (not just placeholder)
	await state.page.waitForFunction(() => {
		const tbl = document.querySelector("table[id$='-innerTable-listUl']");
		if (!tbl) return false;
		const rows = Array.from(tbl.querySelectorAll('tbody tr.sapMListTblRow'));
		return rows.some(row => {
			const cells = Array.from(row.querySelectorAll('td[data-sap-ui-column]'));
			return cells.length > 0;
		});
	});
	const data = await state.page.evaluate(() => {
		const results = [];
		const tables = Array.from(document.querySelectorAll("table[id$='-innerTable-listUl']"));
		tables.forEach((tbl) => {
			const tableListId = tbl.id;
			const basePrefix = tableListId.replace(/-innerTable-listUl$/, '');
			const headerRow = document.querySelector(`#${CSS.escape(basePrefix)}-innerTable-tblHeader`);
			const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th[id$="-innerColumn"]')) : [];
			const columnMap = {};
			headerCells.forEach((th) => {
				const hid = th.id;
				const after = hid.split('::C::')[1] || '';
				const key = after.replace(/-innerColumn$/, '');
				columnMap[hid] = key || hid;
			});
			const rows = [];
			const bodyRows = Array.from(tbl.querySelectorAll('tbody tr.sapMListTblRow'));
			bodyRows.forEach((tr) => {
				const rowObj = {};
				const tds = Array.from(tr.querySelectorAll('td[data-sap-ui-column]'));
				tds.forEach((td) => {
					const colId = td.getAttribute('data-sap-ui-column');
					const key = columnMap[colId] || colId;
					// Handle currency fields with nested spans
					let text = (td.textContent || '').trim();
					if (!text) {
						// Try to get text from nested spans
						const spans = Array.from(td.querySelectorAll('span'));
						text = spans.map(s => s.textContent || '').join(' ').trim();
					}
					if (key) rowObj[key] = text;
				});
				rows.push(rowObj);
			});
			results.push({ tableListId, rows, rowCount: rows.length });
		});
		return results;
	});
	const firstTable = data[0];
	console.log(JSON.stringify({ rows: firstTable?.rows || [], rowCount: firstTable?.rowCount || 0 }, null, 2));
}

async function cmd_getRows(state) {
	const data = await state.page.evaluate(() => {
		const results = [];
		const tables = Array.from(document.querySelectorAll("table[id$='-innerTable-listUl']"));
		tables.forEach((tbl) => {
			const tableListId = tbl.id;
			const basePrefix = tableListId.replace(/-innerTable-listUl$/, '');
			const headerRow = document.querySelector(`#${CSS.escape(basePrefix)}-innerTable-tblHeader`);
			const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th[id$="-innerColumn"]')) : [];
			const columnMap = {};
			headerCells.forEach((th) => {
				const hid = th.id;
				const after = hid.split('::C::')[1] || '';
				const key = after.replace(/-innerColumn$/, '');
				columnMap[hid] = key || hid;
			});
			const rows = [];
			const bodyRows = Array.from(tbl.querySelectorAll('tbody tr.sapMListTblRow'));
			bodyRows.forEach((tr) => {
				const rowObj = {};
				const tds = Array.from(tr.querySelectorAll('td[data-sap-ui-column]'));
				tds.forEach((td) => {
					const colId = td.getAttribute('data-sap-ui-column');
					const key = columnMap[colId] || colId;
					// Handle currency fields with nested spans
					let text = (td.textContent || '').trim();
					if (!text) {
						// Try to get text from nested spans
						const spans = Array.from(td.querySelectorAll('span'));
						text = spans.map(s => s.textContent || '').join(' ').trim();
					}
					if (key) rowObj[key] = text;
				});
				rows.push(rowObj);
			});
			results.push({ tableListId, rows, rowCount: rows.length });
		});
		return results;
	});
	console.log(JSON.stringify({ tables: data }, null, 2));
}

async function cmd_setFilter(state, key, ...valueParts) {
	const value = valueParts.join(' ');
	const all = loadAll();
	const f = all.filters.find((x) => x.propertyKey === key);
	if (!f) throw new Error(`Filter not found: ${key}`);
	
	if (f.selectors.inputCss) {
		// Clear and fill the input field
		await state.page.fill(f.selectors.inputCss, '');
		await state.page.fill(f.selectors.inputCss, String(value));
		// Trigger change events
		await state.page.evaluate((selector) => {
			const input = document.querySelector(selector);
			if (input) {
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
				input.dispatchEvent(new Event('blur', { bubbles: true }));
			}
		}, f.selectors.inputCss);
	} else if (f.selectors.selectCss) {
		await state.page.click(f.selectors.selectCss);
		await state.page.click(`.sapMPopupCont li:has-text("${value}")`);
	} else {
		await state.page.click(f.selectors.filterFieldCss);
		await state.page.keyboard.type(String(value));
		// Trigger change events
		await state.page.evaluate((selector) => {
			const field = document.querySelector(selector);
			if (field) {
				field.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}, f.selectors.filterFieldCss);
	}
	console.log('filter set');
}

async function cmd_execAction(state, ...labelParts) {
	const label = labelParts.join(' ');
	const all = loadAll();
	const table = all.tables[0];
	if (!table) throw new Error('No table found');
	const actions = table.actions || [];
	const act = actions.find((a) => a.id === label || a.text === label);
	if (!act) throw new Error(`Action not found: ${label}`);
	await state.page.click(act.selector);
	console.log('action executed');
}

async function cmd_fillForm(state, fieldName, ...valueParts) {
	const value = valueParts.join(' ');
	
	// First, get all available form fields dynamically
	const fields = await state.page.evaluate(() => {
		const formFields = [];
		
		// Find all input fields in forms
		const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea, select'));
		
		inputs.forEach((input) => {
			const field = {
				id: input.id,
				name: input.name,
				type: input.type || 'text',
				required: input.required || false,
				placeholder: input.placeholder || '',
				value: input.value || '',
				selector: input.id ? `#${CSS.escape(input.id)}` : '',
				label: '',
				fieldName: ''
			};
			
			// Try to find the label for this field
			const label = input.getAttribute('aria-labelledby') ? 
				document.getElementById(input.getAttribute('aria-labelledby')) : 
				input.closest('.sapUiFormCLElement')?.querySelector('label, .sapMLabel');
			
			if (label) {
				const labelText = label.textContent?.trim() || '';
				field.label = labelText.replace(/[:：]$/, ''); // Remove trailing colon
				field.fieldName = field.label.toLowerCase().replace(/\s+/g, '');
			}
			
			// Generate a field name from ID if no label found
			if (!field.fieldName && input.id) {
				const idParts = input.id.split('::');
				const lastPart = idParts[idParts.length - 1];
				field.fieldName = lastPart.toLowerCase().replace(/[-_]/g, '');
			}
			
			formFields.push(field);
		});
		
		return formFields;
	});
	
	// Check if we're on object page to prioritize object page fields
	const isObjectPage = await state.page.evaluate(() => {
		return Boolean(document.querySelector('.sapUxAPObjectPageLayout, .sapFeCoreObjectPage, [id*="ObjectPage"]'));
	});
	
	// Find the matching field by name, label, or ID
	const norm = (s) => (s || '').trim().toLowerCase().replace(/[:：]$/, '');
	const target = norm(fieldName);
	
	let matchedField = null;
	
	// If on object page, prioritize object page fields over filter fields
	if (isObjectPage) {
		// Try to match by exact field name first (object page fields only)
		matchedField = fields.find(f => norm(f.fieldName) === target && !f.id.includes('FilterField'));
		
		// If not found, try to match by label (object page fields only)
		if (!matchedField) {
			matchedField = fields.find(f => norm(f.label) === target && !f.id.includes('FilterField'));
		}
		
		// If still not found, try partial matching (object page fields only)
		if (!matchedField) {
			matchedField = fields.find(f => 
				!f.id.includes('FilterField') && (
					norm(f.fieldName).includes(target) || 
					norm(f.label).includes(target) ||
					norm(f.id).includes(target)
				)
			);
		}
		
		// If still not found on object page, fall back to any field
		if (!matchedField) {
			matchedField = fields.find(f => norm(f.fieldName) === target);
			if (!matchedField) {
				matchedField = fields.find(f => norm(f.label) === target);
			}
			if (!matchedField) {
				matchedField = fields.find(f => 
					norm(f.fieldName).includes(target) || 
					norm(f.label).includes(target) ||
					norm(f.id).includes(target)
				);
			}
		}
	} else {
		// On list page, use original logic
		matchedField = fields.find(f => norm(f.fieldName) === target);
		if (!matchedField) {
			matchedField = fields.find(f => norm(f.label) === target);
		}
		if (!matchedField) {
			matchedField = fields.find(f => 
				norm(f.fieldName).includes(target) || 
				norm(f.label).includes(target) ||
				norm(f.id).includes(target)
			);
		}
	}
	
	if (!matchedField) {
		console.log('Available fields:');
		fields.forEach(f => console.log(`  - ${f.label || f.fieldName || f.id} (${f.id})`));
		throw new Error(`Field not found: ${fieldName}`);
	}
	
	console.log(`Found field: ${matchedField.label || matchedField.fieldName} (${matchedField.id})`);
	
	// Click, clear, and type into the specific input
	const targetSelector = matchedField.selector;
	await state.page.click(targetSelector, { force: true });
	const handle = await state.page.$(targetSelector);
	if (!handle) throw new Error(`Input not interactable for: ${fieldName}`);
	
	await handle.evaluate((input) => {
		if (input && typeof input.focus === 'function') input.focus();
		// Clear value in a UI-friendly way
		if (input && 'value' in input) {
			if (typeof input.select === 'function') input.select();
			else input.value = '';
		}
	});
	
	await state.page.keyboard.type(value);
	
	// Trigger events to ensure UI5 recognizes the change
	await handle.evaluate((input) => {
		if (input) {
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
			input.dispatchEvent(new Event('blur', { bubbles: true }));
		}
	});
	
	console.log(`filled ${matchedField.label || matchedField.fieldName} with "${value}"`);
}

async function cmd_submitForm(state) {
	// Look for Save/Create button - common patterns in SAPUI5
	const saveSelectors = [
		'button[data-sap-ui*="Save"]',
		'button[data-sap-ui*="Create"]', 
		'button[data-sap-ui*="save"]',
		'button[data-sap-ui*="create"]',
		'.sapMBtn:has-text("Save")',
		'.sapMBtn:has-text("Create")',
		'button:has-text("Save")',
		'button:has-text("Create")'
	];
	
	let saved = false;
	for (const selector of saveSelectors) {
		try {
			const button = await state.page.$(selector);
			if (button) {
				await button.click();
				saved = true;
				break;
			}
		} catch (e) {
			// Continue to next selector
		}
	}
	
	if (!saved) {
		throw new Error('Save/Create button not found');
	}
	
	console.log('form submitted');
}

async function cmd_selectRow(state, rowIndexArg) {
    const rowIndex = Number.isFinite(Number(rowIndexArg)) ? Number(rowIndexArg) : 0;
    const table = state.page.locator("table[id$='-innerTable-listUl']");
    await table.waitFor();
    const rows = table.locator('tbody tr.sapMListTblRow');
    const row = rows.nth(Math.max(0, rowIndex));
    const roleCb = row.locator("td[id$='-ModeCell'] [role='checkbox']");
    const cbBg = row.locator("td[id$='-ModeCell'] .sapMCbBg, td[id$='-ModeCell'] .sapMCbMark, td[id$='-ModeCell'] .sapMCb");

    const exists = await roleCb.count();
    if (!exists) {
        await row.click();
        console.log(`row ${rowIndex} clicked`);
        return;
    }

    const before = await roleCb.getAttribute('aria-checked');
    try {
        await roleCb.focus();
        await roleCb.press(' ');
    } catch {}

    let after = await roleCb.getAttribute('aria-checked');
    if (after !== 'true') {
        if (await cbBg.count()) {
            await cbBg.first().click();
            after = await roleCb.getAttribute('aria-checked');
        }
    }
    if (after !== 'true') {
        await row.click();
        after = await roleCb.getAttribute('aria-checked');
    }

    if (after === 'true') console.log(`row ${rowIndex} selected`);
    else console.log(`row ${rowIndex} click issued (selection state unchanged)`);
}

async function cmd_openObject(state, rowIndexArg) {
    const rowIndex = Number.isFinite(Number(rowIndexArg)) ? Number(rowIndexArg) : 0;
    const table = state.page.locator("table[id$='-innerTable-listUl']");
    await table.waitFor();
    const rows = table.locator('tbody tr.sapMListTblRow');
    const row = rows.nth(Math.max(0, rowIndex));
    const typeCell = row.locator("td[id$='-TypeCell']");
    const navIcon = row.locator('td.sapMListTblNavCol .sapMLIBImgNav');

    const oldUrl = state.page.url();

    // Simply click the navigation icon - it doesn't trigger Edit mode
    if (await navIcon.count()) {
        await navIcon.first().click();
    } else {
        throw new Error('Navigation icon not found for this row');
    }

    // Wait for navigation: object page layout OR url/hash change
    await Promise.race([
        state.page.waitForFunction(() => {
            const hasObjectPage = document.querySelector('.sapUxAPObjectPageLayout, [id*="ObjectPage"][data-sap-ui]');
            const hasHeader = document.querySelector('.sapUxAPObjectPageHeader, [id*="fe::Header"]');
            return Boolean(hasObjectPage || hasHeader);
        }, { timeout: 60000 }),
        state.page.waitForFunction((prev) => location.href !== prev, oldUrl, { timeout: 60000 })
    ]);

    console.log('object page opened');
}

async function cmd_getFormFields(state) {
	const fields = await state.page.evaluate(() => {
		const formFields = [];
		
		// Find all input fields in forms
		const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea, select'));
		
		inputs.forEach((input) => {
			const field = {
				id: input.id,
				name: input.name,
				type: input.type,
				required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
				placeholder: input.placeholder || '',
				value: input.value || '',
				selector: `#${CSS.escape(input.id)}`
			};
			
			// Try to find associated label
			const label = document.querySelector(`label[for="${input.id}"]`) || 
						 input.closest('.sapUiFormCLElement')?.querySelector('label, .sapMLabel');
			if (label) {
				field.label = label.textContent?.trim() || '';
			}
			
			// Extract field name from ID or label
			if (field.id) {
				const idParts = field.id.split('::');
				field.fieldName = idParts[idParts.length - 1]?.replace(/Field-edit-inner.*$/, '') || field.id;
			}
			
			formFields.push(field);
		});
		
		return formFields;
	});
	
	console.log(JSON.stringify({ formFields: fields }, null, 2));
}

async function cmd_getObjectActions(state) {
    const actions = await state.page.evaluate(() => {
        function getButtonText(btn) {
            // Prefer BDI content
            const bdi = btn.querySelector('bdi');
            if (bdi && bdi.textContent) return bdi.textContent.trim();
            const content = btn.querySelector('.sapMBtnContent');
            if (content && content.textContent) return content.textContent.trim();
            const label = btn.getAttribute('aria-label') || btn.title || btn.textContent || '';
            return (label || '').trim();
        }

        // Find main actions container in Object Page header
        const containers = Array.from(document.querySelectorAll("[id$='--fe::ObjectPageDynamicHeaderTitle-mainActions'], .sapFDynamicPageTitleMainActions"));
        const results = [];
        containers.forEach((container) => {
            // Include toolbar buttons and possible split/menu buttons
            const btns = Array.from(container.querySelectorAll('button'));
            btns.forEach((btn) => {
                const id = btn.id || '';
                if (!id) return;
                const text = getButtonText(btn);
                const aria = btn.getAttribute('aria-label') || '';
                const title = btn.getAttribute('title') || '';
                const standard = id.includes('StandardAction::');
                results.push({
                    id,
                    text,
                    ariaLabel: aria,
                    title,
                    standard,
                    selector: `#${CSS.escape(id)}`
                });
            });
        });
        return results;
    });
    console.log(JSON.stringify({ actions }, null, 2));
}

async function cmd_execObjectAction(state, ...labelParts) {
    const query = (labelParts.join(' ') || '').trim();
    if (!query) throw new Error('Usage: execObjectAction <label|id>');

    // Try clicking a visible button in the actions container by id or text first
    const clickedDirect = await state.page.evaluate((q) => {
        function getButtonText(btn) {
            const bdi = btn.querySelector('bdi');
            if (bdi && bdi.textContent) return bdi.textContent.trim();
            const content = btn.querySelector('.sapMBtnContent');
            if (content && content.textContent) return content.textContent.trim();
            const label = btn.getAttribute('aria-label') || btn.title || btn.textContent || '';
            return (label || '').trim();
        }
        const norm = (s) => (s || '').trim().toLowerCase();
        const containers = Array.from(document.querySelectorAll("[id$='--fe::ObjectPageDynamicHeaderTitle-mainActions'], .sapFDynamicPageTitleMainActions"));
        for (const container of containers) {
            const btns = Array.from(container.querySelectorAll('button'));
            for (const btn of btns) {
                const id = btn.id || '';
                const text = getButtonText(btn);
                if (norm(id) === norm(q) || norm(text) === norm(q)) {
                    // Prefer UI5 firePress when available for reliability
                    try {
                        const core = window.sap?.ui?.getCore?.();
                        const ctrl = id ? core?.byId?.(id) : null;
                        if (ctrl && typeof ctrl.firePress === 'function') {
                            ctrl.firePress();
                        } else if (typeof btn.click === 'function') {
                            btn.click();
                        }
                    } catch (e) {
                        if (typeof btn.click === 'function') btn.click();
                    }
                    return true;
                }
            }
        }
        // If not found, try to open overflow menu (if present)
        for (const container of containers) {
            const overflowBtn = container.querySelector("button[aria-haspopup='menu']") || container.querySelector("button[id$='-overflowButtonClone']");
            if (overflowBtn && typeof overflowBtn.click === 'function') {
                overflowBtn.click();
                return 'overflow';
            }
        }
        return false;
    }, query);

    if (clickedDirect === true) {
        // Heuristic wait: detect common post-action states (Edit -> Save/Cancel, inputs editable, dialogs)
        try {
            await state.page.waitForFunction(() => {
                const hasSave = document.querySelector("button[id*='StandardAction::Save'], .sapMBtn:has-text('Save')");
                const hasCancel = document.querySelector("button[id*='StandardAction::Cancel'], .sapMBtn:has-text('Cancel')");
                const anyEditableInput = Array.from(document.querySelectorAll('.sapUxAPObjectPageLayout input, .sapUxAPObjectPageLayout textarea, .sapUxAPObjectPageLayout select'))
                    .some((el) => {
                        const input = el;
                        const ro = input && (input).readOnly;
                        const dis = input && (input).disabled;
                        return ro !== true && dis !== true;
                    });
                const dialogOpen = document.querySelector('.sapMDialog, .sapMPopupCont');
                return Boolean(hasSave || hasCancel || anyEditableInput || dialogOpen);
            }, { timeout: 5000 });
        } catch (e) {}
        console.log('object action executed');
        return;
    }

    // If overflow was opened or direct click failed, try to click a menu item by text
    try {
        // Wait briefly for the overflow/menu popup to appear
        await state.page.waitForSelector('.sapMPopupCont, .sapMDialog', { timeout: 3000 });
        const menuItem = state.page.locator(
            ".sapMPopupCont [role='menuitem'], .sapMPopupCont .sapMListUl li, .sapMDialog .sapMListUl li"
        ).filter({ hasText: query });
        await menuItem.first().click({ timeout: 3000 });
        try { await state.page.waitForTimeout(300); } catch {}
        console.log('object action executed');
        return;
    } catch (e) {
        // fallthrough
    }

    throw new Error(`Object action not found: ${query}`);
}

async function cmd_close(state) {
	try { await state.context?.close(); } catch (e) {}
	console.log('closed');
}

async function main() {
	const state = { context: null, page: null };
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'rc> ' });
	rl.prompt();
	rl.on('line', async (line) => {
		const trimmed = line.trim();
		if (!trimmed) { rl.prompt(); return; }
		const [cmd, ...rest] = trimmed.split(' ');
		try {
			if (cmd === 'start') await cmd_start(state, process.env.URL || rest[0]);
			else if (cmd === 'pressGo' || cmd === 'go') await cmd_go(state);
			else if (cmd === 'getRows') await cmd_getRows(state);
			else if (cmd === 'setFilter') await cmd_setFilter(state, ...rest);
			else if (cmd === 'execAction') await cmd_execAction(state, ...rest);
			else if (cmd === 'selectRow') await cmd_selectRow(state, rest[0]);
			else if (cmd === 'openObject') await cmd_openObject(state, rest[0]);
			else if (cmd === 'getObjectActions') await cmd_getObjectActions(state);
			else if (cmd === 'getFormFields') await cmd_getFormFields(state);
			else if (cmd === 'fillForm') {
				if (rest.length < 2) throw new Error('Usage: fillForm <fieldName> <value>');
				await cmd_fillForm(state, rest[0], rest.slice(1).join(' '));
			}
			else if (cmd === 'submitForm') await cmd_submitForm(state);
			else if (cmd === 'execObjectAction') await cmd_execObjectAction(state, ...rest);
			else if (cmd === 'close') await cmd_close(state);
			else if (cmd === 'exit' || cmd === 'quit') { await cmd_close(state); rl.close(); return; }
			else console.log('Unknown command');
		} catch (e) {
			console.error(e.message || String(e));
		}
		rl.prompt();
	});
	rl.on('close', async () => { try { await cmd_close(state); } catch (e) {}; process.exit(0); });
}

main();


