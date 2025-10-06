
const { chromium } = require('playwright');

function parseArgs() {
	const args = process.argv.slice(2);
	const out = { url: null, headed: false, timeout: 120000 };
	for (let i = 0; i < args.length; i += 1) {
		const a = args[i];
		if (a === '--url' || a === '-u') out.url = args[i + 1];
		if (a === '--headed') out.headed = true;
		if (a === '--timeout' || a === '-t') out.timeout = Number(args[i + 1]);
	}
	return out;
}

async function extractRows(page) {
	return page.evaluate(() => {
		const results = [];
		const debug = [];
		const tables = Array.from(document.querySelectorAll("table[id$='-innerTable-listUl']"));
		debug.push(`Found tables: ${tables.length}`);
		tables.forEach((tbl) => {
			const tableListId = tbl.id;
			const basePrefix = tableListId.replace(/-innerTable-listUl$/, '');
			debug.push(`Base prefix: ${basePrefix}`);
			const headerRow = document.querySelector(`#${CSS.escape(basePrefix)}-innerTable-tblHeader`);
			debug.push(`Header row found: ${!!headerRow}`);
			const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th[id$="-innerColumn"]')) : [];
			debug.push(`Header cells found: ${headerCells.length}`);
			const columnMap = {};
			headerCells.forEach((th) => {
				const hid = th.id;
				const after = hid.split('::C::')[1] || '';
				const key = after.replace(/-innerColumn$/, '');
				columnMap[hid] = key || hid;
				debug.push(`Column mapping: ${hid} -> ${key || hid}`);
			});
			const rows = [];
			const bodyRows = Array.from(tbl.querySelectorAll('tbody tr.sapMListTblRow'));
			debug.push(`Body rows found: ${bodyRows.length}`);
			bodyRows.forEach((tr, rowIndex) => {
				const rowObj = {};
				const allTds = Array.from(tr.querySelectorAll('td'));
				debug.push(`Row ${rowIndex}: found ${allTds.length} total cells`);
				const tds = Array.from(tr.querySelectorAll('td[data-sap-ui-column]'));
				debug.push(`Row ${rowIndex}: found ${tds.length} cells with data-sap-ui-column`);
				// Debug all cells
				allTds.forEach((td, cellIndex) => {
					const colId = td.getAttribute('data-sap-ui-column');
					const text = (td.textContent || '').trim();
					debug.push(`All cell ${cellIndex}: colId=${colId}, text="${text}"`);
				});
				tds.forEach((td, cellIndex) => {
					const colId = td.getAttribute('data-sap-ui-column');
					const key = columnMap[colId] || colId;
					// Handle currency fields with nested spans
					let text = (td.textContent || '').trim();
					if (!text) {
						// Try to get text from nested spans
						const spans = Array.from(td.querySelectorAll('span'));
						text = spans.map(s => s.textContent || '').join(' ').trim();
					}
					debug.push(`Cell ${cellIndex}: colId=${colId}, key=${key}, text="${text}"`);
					if (key) rowObj[key] = text;
				});
				debug.push(`Row object: ${JSON.stringify(rowObj)}`);
				rows.push(rowObj);
			});
			results.push({ tableListId, rows, rowCount: rows.length });
		});
		return { results, debug };
	});
}

async function main() {
	const args = parseArgs();
	if (!args.url) {
		console.error('Missing --url');
		process.exit(1);
	}
	const browser = await chromium.launch({ headless: !args.headed });
	const context = await browser.newContext();
	const page = await context.newPage();
	page.setDefaultTimeout(args.timeout);
	page.setDefaultNavigationTimeout(args.timeout);
	try {
		await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeout });
		await page.waitForFunction(() => {
			const w = window;
			return !!(w.sap && w.sap.ui?.getCore?.() && w.sap.ui.getCore().isInitialized?.());
		}, { timeout: args.timeout });
		// Hit Go before reading rows
		await page.evaluate(() => {
			try {
				const go = document.getElementById("sap.nw.core.feap.odatav4::ZZYNC_YNTRAVEL_DBList--fe::FilterBar::ZZYNC_YNTRAVEL_DB-btnSearch");
				if (go) {
					const ctrl = window.sap?.ui?.getCore?.().byId(go.id);
					if (ctrl && typeof ctrl.firePress === 'function') ctrl.firePress(); else go.click();
				}
			} catch (e) { /* ignore */ }
		});
		await page.waitForSelector("table[id$='-innerTable-listUl'] tbody tr", { timeout: args.timeout });
		// Wait for actual data to load (not just placeholder)
		await page.waitForFunction(() => {
			const tbl = document.querySelector("table[id$='-innerTable-listUl']");
			if (!tbl) return false;
			const rows = Array.from(tbl.querySelectorAll('tbody tr.sapMListTblRow'));
			return rows.some(row => {
				const cells = Array.from(row.querySelectorAll('td[data-sap-ui-column]'));
				return cells.length > 0;
			});
		}, { timeout: args.timeout });
		const { results, debug } = await extractRows(page);
		console.log('DEBUG:');
		debug.forEach(line => console.log(line));
		console.log('\nRESULTS:');
		console.log(JSON.stringify({ tables: results }, null, 2));
	} finally {
		await page.close();
		await context.close();
		await browser.close();
	}
}

main().catch((e) => { console.error(e); process.exit(1); });


