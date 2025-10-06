const fs = require('fs');
const path = require('path');

function cssEscape(id) {
	return id?.replace(/([ #.;?+*~\':"!^$\[\]()=>|\/@])/g, '\\$1');
}

function byIdPrefix(controls, prefix) {
	return controls.filter((c) => typeof c.id === 'string' && c.id.startsWith(prefix));
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

function main() {
	const scanPath = path.resolve(process.cwd(), 'scan.json');
	const outPath = path.resolve(process.cwd(), 'tables.json');
	if (!fs.existsSync(scanPath)) {
		console.error('scan.json not found. Run the scanner first.');
		process.exit(1);
	}
	const scan = JSON.parse(fs.readFileSync(scanPath, 'utf-8'));
	const controls = Array.isArray(scan?.controls) ? scan.controls : [];

	const tableRoots = controls.filter((c) => typeof c.id === 'string' && c.id.includes('::table::') && c.id.endsWith('::LineItem'));
	if (tableRoots.length === 0) {
		fs.writeFileSync(outPath, JSON.stringify({ tables: [] }, null, 2), 'utf-8');
		console.log('No FE tables found. Wrote empty tables.json');
		return;
	}

	const tables = tableRoots.map((root) => {
		const tableId = root.id;
		const basePrefix = tableId;
		const innerTable = controls.find((c) => c.id === `${basePrefix}-innerTable`);
		const listUl = controls.find((c) => c.id === `${basePrefix}-innerTable-listUl`);

		const toolbarPrefix = `${basePrefix}-toolbar`;
		const actions = [];
		const actionCandidates = controls.filter((c) => typeof c.id === 'string' && (c.id.startsWith(toolbarPrefix) || c.id.startsWith(`${basePrefix}::`) || c.id.startsWith(`${basePrefix}-export`) || c.id.endsWith('-settings')));
		actionCandidates.forEach((c) => {
			if (c.type && c.type.includes('Button')) {
				const actionType = classifyActionId(c.id);
				actions.push({
					id: c.id,
					text: getText(c),
					actionType,
					selector: `#${cssEscape(c.id)}`
				});
			}
		});

		const customActions = actions.filter((a) => a.actionType === 'custom' || a.actionType === 'custom_candidate');

		// Columns: parse all controls with ids containing `${basePrefix}::C::`
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
			columns.push({
				propertyKey: key,
				label,
				headerColumnId,
				headerColumnCss: `#${cssEscape(headerColumnId)}`
			});
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

	fs.writeFileSync(outPath, JSON.stringify({ tables }, null, 2), 'utf-8');
	console.log(`Wrote ${tables.length} table definitions to ${outPath}`);
}

main();


