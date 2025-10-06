/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseArgs() {
	const args = process.argv.slice(2);
	const out = { url: null, out: 'scan.json', headless: true, timeout: 60000, includeShell: false, p13nColumns: false };
	for (let i = 0; i < args.length; i += 1) {
		const a = args[i];
		if (a === '--url' || a === '-u') out.url = args[i + 1];
		if (a === '--out' || a === '-o') out.out = args[i + 1];
		if (a === '--headed') out.headless = false;
		if (a === '--timeout' || a === '-t') out.timeout = Number(args[i + 1]);
		if (a === '--include-shell') out.includeShell = true;
		if (a === '--p13n-columns') out.p13nColumns = true;
	}
	return out;
}

function extractionFunction(includeShell) {
	return (function extractUi5Controls() {
		if (!window.sap || !sap.ui?.core?.Element?.registry) {
			return { ready: false, controls: [] };
		}

		const isInteractive = (typeName) => {
			if (!typeName) return false;
			return [
				'sap.m.Button',
				'sap.m.OverflowToolbarButton',
				'sap.m.MenuButton',
				'sap.m.Link',
				'sap.m.Input',
				'sap.m.SearchField',
				'sap.m.TextArea',
				'sap.m.Select',
				'sap.m.ComboBox',
				'sap.m.MultiComboBox',
				'sap.m.CheckBox',
				'sap.m.RadioButton',
				'sap.m.Switch',
				'sap.m.DatePicker',
				'sap.m.DateRangeSelection',
				'sap.m.SegmentedButton',
				'sap.ui.table.Table',
				'sap.m.Table',
				'sap.m.List',
				'sap.ui.comp.smartfilterbar.SmartFilterBar',
				'sap.ui.mdc.FilterBar',
				'sap.fe.macros.FilterBarAPI',
				'sap.m.Dialog',
				'sap.f.Dialog',
			].some((p) => typeName.startsWith(p));
		};

		const isShellType = (typeName) => {
			return !!typeName && (typeName.startsWith('sap.ushell') || typeName.startsWith('sap.ui.core.'));
		};

		const escapeCss = (id) => id?.replace(/([ #.;?+*~\':"!^$\[\]()=>|\/@])/g, '\\$1');
		const toStringSafe = (val) => {
			if (val == null) return undefined;
			if (typeof val === 'string') return val;
			if (typeof val === 'number' || typeof val === 'boolean') return String(val);
			// If it's a control with getText
			try { if (val && typeof val.getText === 'function') return val.getText(); } catch (e) {}
			return undefined;
		};

		const controls = [];
		sap.ui.core.Element.registry.forEach((control) => {
			try {
				const metadata = control.getMetadata?.();
				const type = metadata?.getName?.();
				const id = control.getId?.();
				const domRef = control.getDomRef?.();

				if (!domRef) return; // Skip not rendered
				if (!includeShell && isShellType(type) && !isInteractive(type)) return;

				const visible = control.getVisible?.() ?? true;
				const enabled = control.getEnabled?.() ?? true;
				const role = domRef?.getAttribute?.('role') || undefined;
				const ariaLabel = domRef?.getAttribute?.('aria-label') || undefined;
				const ariaDescribedBy = domRef?.getAttribute?.('aria-describedby') || undefined;
				const placeholder = typeof control.getPlaceholder === 'function' ? toStringSafe(control.getPlaceholder()) : undefined;
				const value = typeof control.getValue === 'function' ? toStringSafe(control.getValue()) : undefined;
				let text;
				try {
					if (typeof control.getText === 'function') text = toStringSafe(control.getText());
					else if (typeof control.getTitle === 'function') text = toStringSafe(control.getTitle());
					else if (typeof control.getLabel === 'function') text = toStringSafe(control.getLabel());
				} catch (e) { text = undefined; }
				let tooltip;
				try {
					if (typeof control.getTooltip === 'function') {
						const tt = control.getTooltip();
						tooltip = toStringSafe(tt) || (tt && typeof tt.getText === 'function' ? tt.getText() : undefined);
					}
				} catch (e) { tooltip = undefined; }

				// Bindings
				const bindingPaths = {};
				if (control.mBindingInfos) {
					Object.keys(control.mBindingInfos).forEach((key) => {
						const b = control.getBinding?.(key);
						if (b?.getPath) bindingPaths[key] = b.getPath();
					});
				}

				// Labels
				let labelText;
				try {
					const LabelEnablement = sap.ui?.core?.LabelEnablement;
					if (LabelEnablement && typeof LabelEnablement.getReferencingLabels === 'function') {
						const labels = LabelEnablement.getReferencingLabels(control) || [];
						const labelCtrls = labels.map((lid) => sap.ui.getCore().byId(lid)).filter(Boolean);
						labelText = labelCtrls.map((l) => toStringSafe(l?.getText?.())).filter(Boolean).join(' ');
					}
				} catch (e) { /* ignore label extraction errors */ }

				// Classification
				let roleHint = undefined;
				if (type?.startsWith('sap.m.Button') || role === 'button' || type?.includes('MenuButton')) roleHint = 'button';
				else if (['sap.m.Input', 'sap.m.SearchField', 'sap.m.TextArea', 'sap.m.DatePicker', 'sap.m.DateRangeSelection'].some((p) => type?.startsWith(p))) roleHint = 'input';
				else if (['sap.m.Select', 'sap.m.ComboBox', 'sap.m.MultiComboBox'].some((p) => type?.startsWith(p))) roleHint = 'select';
				else if (type?.includes('.Table') || type?.endsWith('.List')) roleHint = 'table';
				else if (type?.includes('FilterBar')) roleHint = 'filterbar';
				else if (type?.endsWith('.Dialog') || role === 'dialog') roleHint = 'dialog';
				else if (type?.includes('Link')) roleHint = 'link';

				// Table/List specifics
				let tableInfo;
				if (roleHint === 'table') {
					try {
						const rows = typeof control.getItems === 'function' ? control.getItems() : (typeof control.getRows === 'function' ? control.getRows() : []);
						const columns = typeof control.getColumns === 'function' ? control.getColumns() : [];
						tableInfo = {
							rowCount: Array.isArray(rows) ? rows.length : (typeof rows?.length === 'number' ? rows.length : undefined),
							columnCount: Array.isArray(columns) ? columns.length : (typeof columns?.length === 'number' ? columns.length : undefined)
						};
					} catch (e) { /* ignore table info */ }
				}

				// FilterBar specifics
				let filterBarInfo;
				if (roleHint === 'filterbar') {
					try {
						const basicSearch = typeof control.getBasicSearch === 'function' ? control.getBasicSearch() : undefined;
						const filterItems = typeof control.getFilterItems === 'function' ? control.getFilterItems() : undefined;
						const items = Array.isArray(filterItems) ? filterItems : [];
						const itemInfos = items.map((item) => {
							try {
								const itemId = item.getId?.();
								const itemDom = item.getDomRef?.();
								const itemType = item.getMetadata?.().getName?.();
								const itemLabel = (() => {
									try {
										const LabelEnablement = sap.ui?.core?.LabelEnablement;
										if (LabelEnablement && typeof LabelEnablement.getReferencingLabels === 'function') {
											const labels = LabelEnablement.getReferencingLabels(item) || [];
											const lCtrls = labels.map((lid) => sap.ui.getCore().byId(lid)).filter(Boolean);
											return lCtrls.map((l) => toStringSafe(l?.getText?.())).filter(Boolean).join(' ');
										}
									} catch (e) { return undefined; }
									return undefined;
								})();
								const propertyKey = typeof item.getPropertyKey === 'function' ? item.getPropertyKey() : (typeof item.getFieldPath === 'function' ? item.getFieldPath() : undefined);
								let innerRoleHint;
								let innerIds = {};
								try {
									if (itemDom) {
										const input = itemDom.querySelector('.sapMInputBaseInner');
										const select = itemDom.querySelector('.sapMSlt');
										const date = itemDom.querySelector('.sapMDateRangeSelection, .sapMDatePicker');
										if (select) innerRoleHint = 'select';
										else if (date) innerRoleHint = 'date';
										else if (input) innerRoleHint = 'input';
										innerIds = {
											inputId: input?.id,
											selectId: select?.id,
											dateId: date?.id
										};
									}
								} catch (e) { /* ignore */ }
								const localItemId = itemId?.includes('--') ? itemId.split('--').pop() : itemId;
								return {
									id: itemId,
									localId: localItemId,
									type: itemType,
									labelText: itemLabel,
									propertyKey,
									innerRoleHint,
									innerIds
								};
							} catch (e) { return undefined; }
						}).filter(Boolean);
						filterBarInfo = {
							basicSearchPresent: !!basicSearch,
							filterItemCount: items.length,
							items: itemInfos
						};
					} catch (e) { /* ignore filterbar info */ }
				}

				// Stable id hint (view-local id if present)
				const localId = id?.includes('--') ? id.split('--').pop() : id;

				// Helpful selectors
				const selectors = {
					id,
					cssId: `#${escapeCss(id)}`,
					role,
					dataSapUi: domRef?.getAttribute?.('data-sap-ui') || undefined
				};

				controls.push({
					id,
					type,
					role,
					roleHint,
					text,
					labelText,
					value,
					placeholder,
					tooltip,
					visible,
					enabled,
					ariaLabel,
					ariaDescribedBy,
					bindingPaths,
					localId,
					selectors,
					tableInfo,
					filterBarInfo
				});
			} catch (e) { /* ignore */ }
		});

		return { ready: true, controls };
	})();
}

async function main() {
	const args = parseArgs();
	if (!args.url) {
		console.error('Missing --url');
		process.exit(1);
	}

	const browser = await chromium.launch({ headless: args.headless });
	const context = await browser.newContext();
	const page = await context.newPage();

	// Increase defaults globally
	page.setDefaultTimeout(args.timeout);
	page.setDefaultNavigationTimeout(args.timeout);

	try {
		await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: args.timeout });

		// Allow long login time before requiring UI5 core
		await page.waitForFunction(() => {
			const w = window;
			return !!(w.sap && w.sap.ui?.getCore?.() && w.sap.ui.getCore().isInitialized?.());
		}, { timeout: args.timeout });

		// Wait for app controls (view-local ids contain --) to be rendered
		await page.waitForFunction(() => {
			try {
				if (!window.sap || !sap.ui?.core?.Element?.registry) return false;
				let found = false;
				sap.ui.core.Element.registry.forEach((c) => {
					try {
						const id = c.getId?.();
						const domRef = c.getDomRef?.();
						if (id && id.includes('--') && domRef) found = true;
					} catch (e) { /* ignore */ }
				});
				return found;
			} catch (e) { return false; }
		}, { timeout: args.timeout });

		// Explicitly wait for FilterBar
		await page.waitForFunction(() => {
			try {
				let present = false;
				sap.ui.core.Element.registry.forEach((c) => {
					try {
						const type = c.getMetadata?.().getName?.();
						const id = c.getId?.() || '';
						const dom = c.getDomRef?.();
						if (dom && (id.includes('FilterBar') || (type && type.indexOf('FilterBar') >= 0))) present = true;
					} catch (e) { /* ignore */ }
				});
				return present;
			} catch (e) { return false; }
		}, { timeout: args.timeout });

		await page.waitForSelector('[role=button], .sapMBtn, .sapMInputBase, .sapUiTable, .sapMList', { timeout: args.timeout });

		// Trigger FilterBar Go to ensure table data is loaded
		try {
			await page.evaluate(async () => {
				const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
				const goBtn = document.getElementById("sap.nw.core.feap.odatav4::ZZYNC_YNTRAVEL_DBList--fe::FilterBar::ZZYNC_YNTRAVEL_DB-btnSearch");
				if (goBtn) {
					try {
						const ctrl = window.sap?.ui?.getCore?.().byId(goBtn.id);
						if (ctrl && typeof ctrl.firePress === 'function') ctrl.firePress(); else goBtn.click();
					} catch (e) { goBtn.click(); }
					await sleep(500); // brief wait for request dispatch
				}
			});
			// Wait for at least one row to be present
			await page.waitForSelector("table[id$='-innerTable-listUl'] tbody tr", { timeout: Math.min(args.timeout, 10000) });
		} catch (e) { /* ignore if Go not found */ }

		const result = await page.evaluate(extractionFunction, args.includeShell);

		// Optionally open table settings (P13n) and extract full columns list
		let tablesP13n = [];
		let tablesRows = [];
		if (args.p13nColumns) {
			try {
				tablesP13n = await page.evaluate(async () => {
					const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
					const out = [];
					const buttons = Array.from(document.querySelectorAll('button[id$="-settings"]'));
					for (const btn of buttons) {
						try {
							const btnId = btn.id;
							const tableId = btnId.replace(/-settings$/, '');
							// Prefer UI5 control press to handle overflow/disabled state
							try {
								const ctrl = window.sap?.ui?.getCore?.().byId(btnId);
								if (ctrl && typeof ctrl.firePress === 'function') {
									ctrl.firePress();
								} else {
									btn.click();
								}
							} catch (e) { btn.click(); }
							// wait for dialog to render
							for (let i = 0; i < 100; i += 1) {
								if (document.querySelector('.sapMP13nPopup.sapMDialog')) break;
								// eslint-disable-next-line no-await-in-loop
								await sleep(100);
							}
							// Ensure Columns tab selected (usually default)
							const rows = Array.from(document.querySelectorAll('#__panel0-innerSelectionPanelTable-listUl tbody tr'));
							const labels = rows.map((r) => {
								const bdi = r.querySelector('.sapMLabelTextWrapper bdi');
								return bdi ? bdi.textContent.trim() : undefined;
							}).filter(Boolean);
							out.push({ tableId, columns: labels });
							// close dialog (OK button)
							let ok = Array.from(document.querySelectorAll('.sapMP13nPopup .sapMDialogFooter .sapMBtn'))
								.find((el) => el.textContent && el.textContent.trim().toLowerCase() === 'ok');
							if (!ok) {
								ok = document.querySelector(".sapMP13nPopup button[id$='-confirmBtn']");
							}
							ok?.click();
							// allow close
							// eslint-disable-next-line no-await-in-loop
							await sleep(200);
						} catch (e) { /* ignore one table */ }
					}
					return out;
				});
			} catch (e) { /* ignore p13n errors */ }
		}

		// Extract current visible rows' text per table (responsive table)
		try {
			tablesRows = await page.evaluate(() => {
				const results = [];
				const tables = Array.from(document.querySelectorAll("table[id$='-innerTable-listUl']"));
				tables.forEach((tbl) => {
					const tableListId = tbl.id; // maps to basePrefix + '-innerTable-listUl'
					const basePrefix = tableListId.replace(/-innerTable-listUl$/, '');
					// Build header id -> key mapping
					const headerRow = document.querySelector(`#${CSS.escape(basePrefix)}-tblHeader`);
					const headerCells = headerRow ? Array.from(headerRow.querySelectorAll('th[id$="-innerColumn"]')) : [];
					const columnMap = {};
					headerCells.forEach((th) => {
						const hid = th.id; // ...::C::<Key>-innerColumn
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

					results.push({ tableListId, baseId: basePrefix.replace(/-innerTable$/, ''), rows });
				});
				return results;
			});
		} catch (e) { /* ignore rows errors */ }
		const outPath = path.resolve(process.cwd(), args.out);
		const finalOut = { ...result, extras: { tablesP13n, tablesRows } };
		fs.writeFileSync(outPath, JSON.stringify(finalOut, null, 2), 'utf-8');
		console.log(`Wrote ${result.controls?.length ?? 0} controls to ${outPath}`);
	} finally {
		await page.close();
		await context.close();
		await browser.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
