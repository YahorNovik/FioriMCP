const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function cssEscape(id) {
	return id?.replace(/([ #.;?+*~\':"!^$\[\]()=>|\/@])/g, '\\$1');
}

function parseArgs() {
	const args = process.argv.slice(2);
	const out = { url: null, out: 'all.json', timeout: 60000, headed: false, includeShell: false, scanOut: 'scan.json' };
	for (let i = 0; i < args.length; i += 1) {
		const a = args[i];
		if (a === '--url' || a === '-u') out.url = args[i + 1];
		if (a === '--out' || a === '-o') out.out = args[i + 1];
		if (a === '--timeout' || a === '-t') out.timeout = Number(args[i + 1]);
		if (a === '--headed') out.headed = true;
		if (a === '--include-shell') out.includeShell = true;
		if (a === '--scan-out') out.scanOut = args[i + 1];
	}
	return out;
}

function loadScan(scanPath) {
	if (!fs.existsSync(scanPath)) {
		throw new Error(`scan file not found at ${scanPath}`);
	}
	return JSON.parse(fs.readFileSync(scanPath, 'utf-8'));
}

function extractFilters(controls) {
	const filterBars = controls.filter((c) => c.roleHint === 'filterbar' && c.filterBarInfo);
	let fb = null;
	if (filterBars.length > 0) {
		fb = filterBars.reduce((best, cur) => {
			const bestCount = best?.filterBarInfo?.filterItemCount ?? (best?.filterBarInfo?.items?.length ?? 0);
			const curCount = cur?.filterBarInfo?.filterItemCount ?? (cur?.filterBarInfo?.items?.length ?? 0);
			return curCount > bestCount ? cur : best;
		}, filterBars[0]);
	}

	let items = Array.isArray(fb?.filterBarInfo?.items) ? fb.filterBarInfo.items.slice() : [];

	// Also collect all FilterField controls in the page (may include hidden/non-visible ones)
	const allFields = controls.filter((c) => c.type === 'sap.ui.mdc.FilterField');
	const existingIds = new Set(items.map((it) => it.id));
	allFields.forEach((f) => {
		if (!existingIds.has(f.id)) {
			items.push({
				id: f.id,
				localId: f.localId,
				labelText: f.labelText || f.text,
				propertyKey: f.bindingPaths?.conditions ? String(f.bindingPaths.conditions).split('/').pop() : undefined,
				innerIds: {}
			});
		}
	});

	// Deduplicate by propertyKey/localId/id
	const seen = new Set();
	const result = [];
	items.forEach((it) => {
		const key = it.propertyKey || it.localId || it.id;
		if (!key || seen.has(key)) return;
		seen.add(key);
		const propertyKey = key;
		const label = it.labelText || undefined;
		const filterFieldId = it.id;
		const localId = it.localId;
		const innerIds = it.innerIds || {};
		const selectors = {
			filterFieldCss: filterFieldId ? `#${cssEscape(filterFieldId)}` : undefined,
			inputCss: innerIds.inputId ? `#${cssEscape(innerIds.inputId)}` : undefined,
			selectCss: innerIds.selectId ? `#${cssEscape(innerIds.selectId)}` : undefined,
			dateCss: innerIds.dateId ? `#${cssEscape(innerIds.dateId)}` : undefined,
		};
		result.push({ propertyKey, label, filterFieldId, localId, selectors });
	});

	return result;
}

function getText(c) {
	return c?.text || c?.labelText || undefined;
}

function classifyActionId(id) {
	if (!id) return 'unknown';
	if (id.includes('::StandardAction::')) return 'standard';
	if (id.endsWith('-settings') || id.includes('-export')) return 'standard';
	if (id.includes('showHideDetails')) return 'standard';
	if (id.includes('toolbar-overflowButton')) return 'standard';
	if (id.includes('::CustomAction::')) return 'custom';
	return 'custom_candidate';
}

function extractTables(controls) {
	const tableRoots = controls.filter((c) => typeof c.id === 'string' && c.id.includes('::table::') && c.id.endsWith('::LineItem'));
	return tableRoots.map((root) => {
		const tableId = root.id;
		const basePrefix = tableId;
		const innerTable = controls.find((c) => c.id === `${basePrefix}-innerTable`);
		const listUl = controls.find((c) => c.id === `${basePrefix}-innerTable-listUl`);

		const toolbarPrefix = `${basePrefix}-toolbar`;
		const actionCandidates = controls.filter((c) => typeof c.id === 'string' && (c.id.startsWith(toolbarPrefix) || c.id.startsWith(`${basePrefix}::`) || c.id.startsWith(`${basePrefix}-export`) || c.id.endsWith('-settings')));
		const actions = actionCandidates.filter((c) => c.type && c.type.includes('Button')).map((c) => ({
			id: c.id,
			text: getText(c),
			actionType: classifyActionId(c.id),
			selector: `#${cssEscape(c.id)}`
		}));
		const customActions = actions.filter((a) => a.actionType === 'custom' || a.actionType === 'custom_candidate');

		const colIdControls = controls.filter((c) => typeof c.id === 'string' && c.id.includes(`${basePrefix}::C::`));
		const seenKeys = new Set();
		const columns = [];
		colIdControls.forEach((c) => {
			const after = c.id.split(`${basePrefix}::C::`)[1];
			if (!after) return;
			const key = after.split('-')[0];
			if (!key || seenKeys.has(key)) return;
			seenKeys.add(key);
			const headerControl = colIdControls.find((hc) => hc.id === `${basePrefix}::C::${key}`) || c;
			const label = getText(headerControl) || key;
			const headerColumnId = `${basePrefix}::C::${key}-innerColumn`;
			columns.push({ propertyKey: key, label, headerColumnId, headerColumnCss: `#${cssEscape(headerColumnId)}` });
		});

		const selectAllId = `${basePrefix}-innerTable-sa`;
		const selectAll = controls.find((c) => c.id === selectAllId);

		return {
			tableId,
			innerTableId: innerTable?.id,
			listUlId: listUl?.id,
			selectors: {
				tableCss: `#${cssEscape(tableId)}`,
				innerTableCss: innerTable?.id ? `#${cssEscape(innerTable.id)}` : undefined,
				listUlCss: listUl?.id ? `#${cssEscape(listUl.id)}` : undefined,
				selectAllCss: selectAll ? `#${cssEscape(selectAllId)}` : undefined
			},
			actions,
			customActions,
			columns
		};
	});
}

async function main() {
	const args = parseArgs();
	const scanOutPath = path.resolve(process.cwd(), args.scanOut);
	if (args.url) {
		const cmdArgs = ['src/scan.js', '--url', args.url, '--out', scanOutPath, '--timeout', String(args.timeout), '--p13n-columns'];
		if (args.headed) cmdArgs.push('--headed');
		if (args.includeShell) cmdArgs.push('--include-shell');
		const res = spawnSync('node', cmdArgs, { stdio: 'inherit' });
		if (res.status !== 0) {
			process.exit(res.status || 1);
		}
	}

	const scan = loadScan(scanOutPath);
	const controls = Array.isArray(scan?.controls) ? scan.controls : [];
	const filters = extractFilters(controls);
	const tables = extractTables(controls);

	// Merge P13n columns (from settings dialog) if available
	const p13n = scan?.extras?.tablesP13n || [];
	if (Array.isArray(p13n) && p13n.length > 0) {
		p13n.forEach((t) => {
			const target = tables.find((x) => x.tableId === t.tableId || x.selectors?.tableCss?.includes(cssEscape(t.tableId)));
			if (!target) return;
			const existingKeys = new Set(target.columns.map((c) => c.propertyKey));
			const existingLabels = new Set(target.columns.map((c) => c.label));
			const merged = [...target.columns];
			(t.columns || []).forEach((label) => {
				if (existingLabels.has(label)) return;
				// Add as label-only column when key is unknown; agent can map later
				merged.push({ propertyKey: label, label });
			});
			target.columns = merged;
			target.columnsSource = 'scan+dialog';
		});
	}

	// Intentionally do not attach dynamic rows/rowCount here; keep all.json static-only

	const outPath = path.resolve(process.cwd(), args.out);
	fs.writeFileSync(outPath, JSON.stringify({ filters, tables }, null, 2), 'utf-8');
	console.log(`Wrote combined extraction to ${outPath}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});


