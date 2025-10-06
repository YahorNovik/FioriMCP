const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const STATE_PATH = path.resolve(process.cwd(), '.pw-state');
const ALL_JSON = path.resolve(process.cwd(), 'all.json');

function loadAll() {
	if (!fs.existsSync(ALL_JSON)) throw new Error('all.json not found. Run extract-all first.');
	return JSON.parse(fs.readFileSync(ALL_JSON, 'utf-8'));
}

function parseArgs() {
	const a = process.argv.slice(2);
	return { cmd: a[0], url: process.env.URL || null, args: a.slice(1) };
}

async function getBrowser(headed = true) {
	const browser = await chromium.launchPersistentContext(STATE_PATH, { headless: !headed });
	const pages = browser.pages();
	const page = pages.length ? pages[0] : await browser.newPage();
	return { browser, page };
}

async function start(url, timeout = 600000, headed = true) {
	if (!url) throw new Error('Missing URL');
	const { browser, page } = await getBrowser(headed);
	page.setDefaultTimeout(timeout);
	page.setDefaultNavigationTimeout(timeout);
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
	await page.waitForFunction(() => {
		const w = window;
		return !!(w.sap && w.sap.ui?.getCore?.() && w.sap.ui.getCore().isInitialized?.());
	}, { timeout });
	return { browser, page };
}

async function go(page) {
	await page.evaluate(() => {
		try {
			const go = document.getElementById("sap.nw.core.feap.odatav4::ZZYNC_YNTRAVEL_DBList--fe::FilterBar::ZZYNC_YNTRAVEL_DB-btnSearch");
			if (go) {
				const ctrl = window.sap?.ui?.getCore?.().byId(go.id);
				if (ctrl && typeof ctrl.firePress === 'function') ctrl.firePress(); else go.click();
			}
		} catch (e) { /* ignore */ }
	});
	await page.waitForSelector("table[id$='-innerTable-listUl'] tbody tr");
	// Wait until table not busy
	await page.waitForFunction(() => {
		const tbl = document.querySelector("table[id$='-innerTable-listUl']");
		if (!tbl) return false;
		const rows = tbl.querySelectorAll('tbody tr.sapMListTblRow');
		if (rows.length === 0) return false;
		const first = rows[0];
		const tds = first.querySelectorAll("td[data-sap-ui-column]");
		for (const td of tds) {
			const txt = (td.textContent || '').trim();
			if (txt) return true;
		}
		// If cells have nested controls (e.g., currency spans), consider non-empty inner text excluding whitespace
		const inner = (first.innerText || '').trim();
		return inner.length > 0;
	}, { timeout: 15000 });
    // Return current rows
    const tables = await getRows(page);
    const firstTable = tables[0] || { rows: [], rowCount: 0 };
    console.log(JSON.stringify({ rows: firstTable.rows, rowCount: firstTable.rowCount }, null, 2));
}

async function getRows(page) {
	return page.evaluate(() => {
		const results = [];
		const tables = Array.from(document.querySelectorAll("table[id$='-innerTable-listUl']"));
		tables.forEach((tbl) => {
			const tableListId = tbl.id;
			const basePrefix = tableListId.replace(/-innerTable-listUl$/, '');
			const headerRow = document.querySelector(`#${CSS.escape(basePrefix)}-tblHeader`);
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
					const text = (td.textContent || '').trim();
					if (key) rowObj[key] = text;
				});
				rows.push(rowObj);
			});
			results.push({ tableListId, rowCount: rows.length, rows });
		});
		return results;
	});
}

async function setFilter(page, propertyKey, value) {
	const all = loadAll();
	const f = all.filters.find((x) => x.propertyKey === propertyKey);
	if (!f) throw new Error(`Filter not found: ${propertyKey}`);
	// Try input first, otherwise select
	if (f.selectors.inputCss) {
		await page.fill(f.selectors.inputCss, String(value));
	} else if (f.selectors.selectCss) {
		await page.click(f.selectors.selectCss);
		// pick first matching option by text
		await page.click(`.sapMPopupCont li:has-text("${value}")`);
	} else {
		// fallback: focus field container then type
		await page.click(f.selectors.filterFieldCss);
		await page.keyboard.type(String(value));
	}
}

async function execAction(page, actionLabelOrId) {
	const all = loadAll();
	const table = all.tables[0];
	if (!table) throw new Error('No table found');
	const actions = table.actions || [];
	let act = actions.find((a) => a.id === actionLabelOrId || a.text === actionLabelOrId);
	if (!act) throw new Error(`Action not found: ${actionLabelOrId}`);
	await page.click(act.selector);
}

async function close() {
	// Close persistent context
	try { fs.rmSync(STATE_PATH, { recursive: true, force: true }); } catch (e) {}
}

async function main() {
	const { cmd, url, args } = parseArgs();
	if (!cmd) {
		console.error('Usage: node src/rc.js <start|pressGo|getRows|setFilter|execAction|close>');
		process.exit(1);
	}
	if (cmd === 'start') {
		await start(url, 600000, true);
		console.log('started');
		return;
	}
	const { browser, page } = await getBrowser(true);
	try {
		if (cmd === 'pressGo' || cmd === 'go') {
			await go(page);
		} else if (cmd === 'getRows') {
			const data = await getRows(page);
			console.log(JSON.stringify({ tables: data }, null, 2));
		} else if (cmd === 'setFilter') {
			const [key, ...rest] = args;
			const value = rest.join(' ');
			await setFilter(page, key, value);
			console.log('filter set');
		} else if (cmd === 'execAction') {
			const label = args.join(' ');
			await execAction(page, label);
			console.log('action executed');
		} else if (cmd === 'close') {
			await browser.close();
			await close();
			console.log('closed');
		} else {
			console.error('Unknown command');
			process.exit(1);
		}
	} finally {
		await browser.close();
	}
}

main().catch((e) => { console.error(e); process.exit(1); });


