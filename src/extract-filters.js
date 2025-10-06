const fs = require('fs');
const path = require('path');

function cssEscape(id) {
	return id?.replace(/([ #.;?+*~\':"!^$\[\]()=>|\/@])/g, '\\$1');
}

function main() {
	const scanPath = path.resolve(process.cwd(), 'scan.json');
	const outPath = path.resolve(process.cwd(), 'filters.json');
	if (!fs.existsSync(scanPath)) {
		console.error('scan.json not found. Run the scanner first.');
		process.exit(1);
	}
	const scan = JSON.parse(fs.readFileSync(scanPath, 'utf-8'));
	const controls = Array.isArray(scan?.controls) ? scan.controls : [];

	// Prefer FilterBar with the most items
	const filterBars = controls.filter((c) => c.roleHint === 'filterbar' && c.filterBarInfo);
	let fb = null;
	if (filterBars.length > 0) {
		fb = filterBars.reduce((best, cur) => {
			const bestCount = best?.filterBarInfo?.filterItemCount ?? (best?.filterBarInfo?.items?.length ?? 0);
			const curCount = cur?.filterBarInfo?.filterItemCount ?? (cur?.filterBarInfo?.items?.length ?? 0);
			return curCount > bestCount ? cur : best;
		}, filterBars[0]);
	}

	let items = Array.isArray(fb?.filterBarInfo?.items) ? fb.filterBarInfo.items : [];

	// Fallback: derive from individual FilterField controls
	if (items.length === 0) {
		const fields = controls.filter((c) => c.type === 'sap.ui.mdc.FilterField');
		items = fields.map((f) => {
			return {
				id: f.id,
				localId: f.localId,
				labelText: f.labelText || f.text,
				propertyKey: f.bindingPaths?.conditions ? String(f.bindingPaths.conditions).split('/').pop() : undefined,
				innerIds: {}
			};
		});
	}

	const filters = items.map((it) => {
		const propertyKey = it.propertyKey || it.localId || it.id;
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
		return { propertyKey, label, filterFieldId, localId, selectors };
	});

	fs.writeFileSync(outPath, JSON.stringify({ filters }, null, 2), 'utf-8');
	console.log(`Wrote ${filters.length} filters to ${outPath}`);
}

main();


