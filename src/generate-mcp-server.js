#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

/**
 * Dynamic MCP Server Generator for Fiori Apps
 * 
 * This script analyzes a Fiori application and generates a standardized MCP server
 * with tools for interacting with the app dynamically.
 */

class FioriMCPGenerator {
    constructor(url) {
        this.url = url;
        this.appMetadata = null;
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async analyzeApp() {
        console.log(`Analyzing Fiori app: ${this.url}`);
        
        // Launch browser
        const ANALYZE_HEADLESS = (process.env.HEADLESS === '1' || process.env.HEADLESS === 'true');
        this.browser = await chromium.launch({ 
            headless: ANALYZE_HEADLESS, // Override with HEADLESS env if needed
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        
        this.page = await this.context.newPage();
        this.page.setDefaultTimeout(600000);
        this.page.setDefaultNavigationTimeout(600000);

        // Navigate to the app
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
        
        // Wait for UI5 to initialize
        await this.page.waitForFunction(() => {
            const w = window;
            return !!(w.sap && w.sap.ui?.getCore?.() && w.sap.ui.getCore().isInitialized?.());
        });

        console.log('UI5 initialized, extracting app metadata...');

        // Extract app metadata
        this.appMetadata = await this.extractAppMetadata();
        
        console.log('App analysis complete!');
        return this.appMetadata;
    }

    async extractAppMetadata() {
        // Extract filters
        const filters = await this.page.evaluate(() => {
            const filterFields = [];
            const filterElements = Array.from(document.querySelectorAll('[id*="FilterField"]'));
            
            filterElements.forEach((el) => {
                const input = el.querySelector('input, textarea, select');
                if (input) {
                    const label = el.querySelector('label, .sapMLabel');
                    const labelText = label ? label.textContent?.trim().replace(/[:：]$/, '') : '';
                    
                    filterFields.push({
                        id: input.id,
                        label: labelText,
                        type: input.type || 'text',
                        selector: `#${CSS.escape(input.id)}`,
                        propertyKey: labelText.toLowerCase().replace(/\s+/g, '')
                    });
                }
            });
            
            return filterFields;
        });

        // Extract table actions
        const tables = await this.page.evaluate(() => {
            const results = [];
            const tableElements = Array.from(document.querySelectorAll('table[id$="-innerTable-listUl"]'));
            
            tableElements.forEach((table) => {
                const tableId = table.id;
                const basePrefix = tableId.replace(/-innerTable-listUl$/, '');
                const toolbar = document.querySelector(`#${CSS.escape(basePrefix)}-toolbar`);
                
                const actions = [];
                if (toolbar) {
                    const buttons = Array.from(toolbar.querySelectorAll('button[id*="StandardAction"], button[id*="Action"]'));
                    buttons.forEach((btn) => {
                        const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
                        if (text) {
                            actions.push({
                                id: btn.id,
                                text: text,
                                selector: `#${CSS.escape(btn.id)}`,
                                standard: btn.id.includes('StandardAction')
                            });
                        }
                    });
                }
                
                results.push({
                    id: tableId,
                    actions: actions
                });
            });
            
            return results;
        });

        // Extract table columns
        const columns = await this.page.evaluate(() => {
            const results = [];
            const tables = Array.from(document.querySelectorAll('table[id$="-innerTable-listUl"]'));
            
            tables.forEach((table) => {
                const tableId = table.id;
                const basePrefix = tableId.replace(/-innerTable-listUl$/, '');
                const headerRow = document.querySelector(`#${CSS.escape(basePrefix)}-innerTable-tblHeader`);
                
                if (headerRow) {
                    const headerCells = Array.from(headerRow.querySelectorAll('th[id$="-innerColumn"]'));
                    const columnMap = {};
                    
                    headerCells.forEach((th) => {
                        const label = th.querySelector('.sapMLabel, label');
                        const labelText = label ? label.textContent?.trim().replace(/[:：]$/, '') : '';
                        const columnId = th.id;
                        
                        if (labelText) {
                            columnMap[labelText] = {
                                id: columnId,
                                label: labelText,
                                selector: `#${CSS.escape(columnId)}`
                            };
                        }
                    });
                    
                    results.push({
                        tableId: tableId,
                        columns: columnMap
                    });
                }
            });
            
            return results;
        });

        return {
            url: this.url,
            filters: filters,
            tables: tables,
            columns: columns,
            extractedAt: new Date().toISOString()
        };
    }

    generateMCPServer() {
        const serverCode = `#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

/**
 * Auto-generated MCP Server for Fiori App
 * Generated for: ${this.url}
 * Generated at: ${new Date().toISOString()}
 */

class FioriAppServer {
    constructor() {
        this.server = new Server(
            {
                name: 'fiori-app-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.browser = null;
        this.context = null;
        this.page = null;
        this.appMetadata = ${JSON.stringify(this.appMetadata, null, 8)};
        this.flowRecorder = { isRecording: false, steps: [] };

        this.setupToolHandlers();
    }

    async ensureBrowserStarted() {
        const isClosed = (obj) => {
            try { return !obj; } catch { return true; }
        };
        if (!this.browser || isClosed(this.browser) || this.browser.isConnected && !this.browser.isConnected()) {
            const HEADLESS = (process.env.HEADLESS === '1' || process.env.HEADLESS === 'true');
            this.browser = await chromium.launch({ 
                headless: HEADLESS,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        if (!this.context || isClosed(this.context)) {
            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 }
            });
        }
        if (!this.page || isClosed(this.page)) {
            this.page = await this.context.newPage();
            this.page.setDefaultTimeout(600000);
            this.page.setDefaultNavigationTimeout(600000);
        }
    }

    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'start_app',
                        description: 'Start the Fiori application',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'press_go',
                        description: 'Press the Go button to refresh table data',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_table_rows',
                        description: 'Get current table rows data',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'execute_action',
                        description: 'Execute an action on the table',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Action name to execute'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'select_row',
                        description: 'Select a specific row in the table',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                rowIndex: {
                                    type: 'number',
                                    description: 'Row index to select (0-based)'
                                }
                            },
                            required: ['rowIndex']
                        }
                    },
                    {
                        name: 'open_object_page',
                        description: 'Open object page for a selected row',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                rowIndex: {
                                    type: 'number',
                                    description: 'Row index to open object page for (0-based)'
                                }
                            },
                            required: ['rowIndex']
                        }
                    },
                    {
                        name: 'get_object_actions',
                        description: 'Get available actions on object page',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_object_fields',
                        description: 'Read object page field label/value pairs dynamically',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'execute_object_action',
                        description: 'Execute an action on object page',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Action name to execute'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'fill_form_field',
                        description: 'Fill a form field',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                fieldName: {
                                    type: 'string',
                                    description: 'Field name to fill'
                                },
                                value: {
                                    type: 'string',
                                    description: 'Value to fill'
                                }
                            },
                            required: ['fieldName', 'value']
                        }
                    },
                    {
                        name: 'get_form_fields',
                        description: 'List available form fields on current page',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_filter_fields',
                        description: 'List available filter fields in the filter bar',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_table_actions',
                        description: 'Get available actions on the current table toolbar',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'execute_table_action',
                        description: 'Execute an action on the current table toolbar',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Action name to execute (e.g., Create, Delete)'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'execute_dialog_action',
                        description: 'Execute a button inside the currently open Fiori dialog (e.g., Update/Ok/Cancel)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Button text or aria-label to click in the open dialog'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'set_filter',
                        description: 'Set a filter value by property key',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                propertyKey: {
                                    type: 'string',
                                    description: 'The property key of the filter field'
                                },
                                value: {
                                    type: 'string',
                                    description: 'The value to set for the filter'
                                }
                            },
                            required: ['propertyKey', 'value']
                        }
                    },
                    {
                        name: 'submit_form',
                        description: 'Submit the current form',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'discard_draft',
                        description: 'Discard current draft (Cancel)',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_clickable_elements',
                        description: 'Discover visible clickable elements (buttons, links) with selectors. Returns array of elements with id, text, tag, role, enabled status, and CSS selector. Use this to find elements before clicking or highlighting them.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'highlight_element',
                        description: 'Temporarily highlight an element by CSS selector to visually confirm the target. Use this to verify you have the right element before clicking.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector of the element to highlight' },
                                durationMs: { type: 'number', description: 'Highlight duration in ms (default 1500)' }
                            },
                            required: ['selector']
                        }
                    },
                    {
                        name: 'click_by_selector',
                        description: 'Click an element by CSS selector (UI5-aware). Automatically uses UI5 firePress() if available, otherwise DOM click.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector of the element to click' }
                            },
                            required: ['selector']
                        }
                    },
                    {
                        name: 'type_by_selector',
                        description: 'Type/replace value in an input/textarea by CSS selector. Clears existing value and types new one.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector of the input/textarea' },
                                value: { type: 'string', description: 'Value to type' }
                            },
                            required: ['selector', 'value']
                        }
                    },
                    {
                        name: 'wait_for_selector',
                        description: 'Wait for an element to appear by CSS selector. Useful after clicking buttons that open dialogs or load content.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector to wait for' },
                                timeoutMs: { type: 'number', description: 'Timeout in ms (default 5000)' }
                            },
                            required: ['selector']
                        }
                    },
                    {
                        name: 'wait_for_missing_selector',
                        description: 'Wait for an element to disappear by CSS selector. Useful after closing dialogs or completing actions.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector to wait to disappear' },
                                timeoutMs: { type: 'number', description: 'Timeout in ms (default 5000)' }
                            },
                            required: ['selector']
                        }
                    },
                    {
                        name: 'get_messages',
                        description: 'Collect UI5 messages (popovers, dialogs, strips, toasts) from the current page. Use this to check for error/success messages after actions. No parameters needed.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'record_flow_start',
                        description: 'Start recording a flow of actions. After starting, all subsequent actions will be recorded until you call record_flow_stop. No parameters needed.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'record_flow_stop',
                        description: 'Stop recording and return the recorded steps as JSON. Use this to capture a sequence of actions for reuse. No parameters needed.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'close_app',
                        description: 'Close the application',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                // Guard: ensure page is initialized for all tools except start_app
                if (name !== 'start_app' && (!this.page || this.page.isClosed?.())) {
                    throw new Error("Browser page is not initialized. Call 'start_app' first.");
                }
                let result;
                switch (name) {
                    case 'start_app':
                        result = await this.startApp();
                        break;
                    case 'press_go':
                        result = await this.pressGo();
                        break;
                    case 'get_table_rows':
                        result = await this.getTableRows();
                        break;
                    case 'execute_action':
                        result = await this.executeAction(args.action);
                        break;
                    case 'select_row':
                        result = await this.selectRow(args.rowIndex);
                        break;
                    case 'open_object_page':
                        result = await this.openObjectPage(args.rowIndex);
                        break;
                    case 'get_object_actions':
                        result = await this.getObjectActions();
                        break;
                    case 'get_object_fields':
                        result = await this.getObjectFields();
                        break;
                    case 'execute_object_action':
                        result = await this.executeObjectAction(args.action);
                        break;
                    case 'fill_form_field':
                        result = await this.fillFormField(args.fieldName, args.value);
                        break;
                    case 'get_form_fields':
                        result = await this.getFormFields();
                        break;
                    case 'get_filter_fields':
                        result = await this.getFilterFields();
                        break;
                    case 'get_table_actions':
                        result = await this.getTableActions();
                        break;
                    case 'execute_table_action':
                        result = await this.executeTableAction(args.action);
                        break;
                    case 'execute_dialog_action':
                        result = await this.executeDialogAction(args.action);
                        break;
                    case 'set_filter':
                        result = await this.setFilter(args.propertyKey, args.value);
                        break;
                    case 'submit_form':
                        result = await this.submitForm();
                        break;
                    case 'discard_draft':
                        result = await this.discardDraft();
                        break;
                    case 'get_clickable_elements':
                        result = await this.getClickableElements();
                        break;
                    case 'highlight_element':
                        result = await this.highlightElement(args.selector, args.durationMs);
                        break;
                    case 'click_by_selector':
                        result = await this.clickBySelector(args.selector);
                        break;
                    case 'type_by_selector':
                        result = await this.typeBySelector(args.selector, args.value);
                        break;
                    case 'wait_for_selector':
                        result = await this.waitForSelector(args.selector, args.timeoutMs);
                        break;
                    case 'wait_for_missing_selector':
                        result = await this.waitForMissingSelector(args.selector, args.timeoutMs);
                        break;
                    case 'get_messages':
                        result = await this.getMessages();
                        break;
                    case 'record_flow_start':
                        result = await this.recordFlowStart();
                        break;
                    case 'record_flow_stop':
                        result = await this.recordFlowStop();
                        break;
                    case 'close_app':
                        result = await this.closeApp();
                        break;
                    default:
                        throw new Error('Unknown tool: ' + name);
                }
                // Post-tool wait: 10s for start_app handled inside startApp; 3s for others
                if (name !== 'start_app' && this.page) {
                    try { await this.page.waitForTimeout(3000); } catch (e) {}
                }
                return result;
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Error: ' + error.message
                        }
                    ]
                };
            }
        });
    }

    async startApp() {
        await this.ensureBrowserStarted();
        try {
        await this.page.goto(this.appMetadata.url, { waitUntil: 'domcontentloaded' });
        } catch (e) {
            // Recover from closed targets by recreating context/page and retry once
            await this.closeApp();
            await this.ensureBrowserStarted();
            await this.page.goto(this.appMetadata.url, { waitUntil: 'domcontentloaded' });
        }
        await this.page.waitForFunction(() => {
            const w = window;
            return !!(w.sap && w.sap.ui?.getCore?.() && w.sap.ui.getCore().isInitialized?.());
        });
        // Wait to allow the app to fully render and settle
        await this.page.waitForTimeout(10000);
        
        return {
            content: [
                { type: 'text', text: 'Fiori application started successfully' }
            ]
        };
    }

    async pressGo() {
        await this.page.evaluate(() => {
            try {
                // Dynamic Go button detection - try multiple common patterns
                const goButtonSelectors = [
                    // Common Fiori patterns
                    'button[id$="-btnSearch"]',
                    'button[id*="btnSearch"]', 
                    'button[id$="-search"]',
                    'button[id*="search"]',
                    'button[id$="-go"]',
                    'button[id*="go"]',
                    'button[id$="-filter"]',
                    'button[id*="filter"]',
                    // Generic patterns
                    'button[title*="Search"]',
                    'button[title*="Go"]',
                    'button[aria-label*="Search"]',
                    'button[aria-label*="Go"]',
                    // Text-based patterns
                    'button:has-text("Go")',
                    'button:has-text("Search")',
                    'button:has-text("Apply")'
                ];
                
                let goButton = null;
                for (const selector of goButtonSelectors) {
                    goButton = document.querySelector(selector);
                    if (goButton) break;
                }
                
                if (goButton) {
                    const ctrl = window.sap?.ui?.getCore?.().byId(goButton.id);
                    if (ctrl && typeof ctrl.firePress === 'function') {
                        ctrl.firePress();
                    } else {
                        goButton.click();
                    }
                } else {
                    console.warn('Go button not found with any selector');
                }
            } catch (e) { 
                console.warn('Error pressing Go button:', e.message);
            }
        });
        
        // Wait a moment for the table to refresh with new data
        await this.page.waitForTimeout(2000);
        await this.page.waitForSelector("table[id$='-innerTable-listUl'] tbody tr");
        
        // Check if we have "No data found" message
        const hasNoDataMessage = await this.page.evaluate(() => {
            const noDataTitle = document.querySelector('.sapMIllustratedMessageMainContent .sapMTitle span');
            return noDataTitle && noDataTitle.textContent.includes('No data');
        });
        
        if (hasNoDataMessage) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ rows: [], rowCount: 0, message: "No data found" }, null, 2)
                    }
                ]
            };
        }
        
        // Wait for actual data to load (not just placeholder)
        await this.page.waitForFunction(() => {
            const tbl = document.querySelector("table[id$='-innerTable-listUl']");
            if (!tbl) return false;
            const rows = Array.from(tbl.querySelectorAll('tbody tr.sapMListTblRow'));
            return rows.some(row => {
                const cells = Array.from(row.querySelectorAll('td[data-sap-ui-column]'));
                return cells.length > 0;
            });
        });
        // Also return current table rows
        const rows = await this.getTableRows();
        return {
            content: [
                { type: 'text', text: 'Go button pressed, table data refreshed' },
                ...rows.content
            ]
        };
    }

    async isGoAvailable() {
        const available = await this.page.evaluate(() => {
            const goButtonSelectors = [
                'button[id$="-btnSearch"]',
                'button[id*="btnSearch"]',
                'button[id$="-search"]',
                'button[id*="search"]',
                'button[id$="-go"]',
                'button[id*="go"]',
                'button:has-text("Go")',
                '.sapMBtn:has-text("Go")'
            ];
            for (const sel of goButtonSelectors) {
                const el = document.querySelector(sel);
                if (el && !el.hasAttribute('disabled') && !el.classList.contains('sapMBtnDisabled')) {
                    return true;
                }
            }
            return false;
        });
        return {
            content: [{ type: 'text', text: JSON.stringify({ goAvailable: available }, null, 2) }]
        };
    }

    async getTableRows() {
        const data = await this.page.evaluate(() => {
            const results = [];
            const tables = Array.from(document.querySelectorAll("table[id$='-innerTable-listUl']"));
            tables.forEach((tbl) => {
                const tableListId = tbl.id;
                const basePrefix = tableListId.replace(/-innerTable-listUl$/, '');
                const headerRow = document.querySelector(\`#\${CSS.escape(basePrefix)}-innerTable-tblHeader\`);
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
                        let text = (td.textContent || '').trim();
                            if (!text) {
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
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ tables: data }, null, 2)
                }
            ]
        };
    }

    async setFilter(fieldName, value) {
        // Load the actual filter data from all.json
        const fs = require('fs');
        const path = require('path');
        const ALL_JSON = path.resolve(process.cwd(), 'all.json');
        
        if (!fs.existsSync(ALL_JSON)) {
            throw new Error('all.json not found. Run extract-all first.');
        }
        
        const all = JSON.parse(fs.readFileSync(ALL_JSON, 'utf-8'));
        const f = all.filters.find((x) => x.propertyKey === fieldName);
        if (!f) throw new Error(\`Filter not found: \${fieldName}\`);
        
        if (f.selectors.inputCss) {
            // Clear and fill the input field
            await this.page.fill(f.selectors.inputCss, '');
            await this.page.fill(f.selectors.inputCss, String(value));
            // Trigger change events
            await this.page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, f.selectors.inputCss);
        } else if (f.selectors.selectCss) {
            await this.page.click(f.selectors.selectCss);
            await this.page.click(\`.sapMPopupCont li:has-text("\${value}")\`);
        } else {
            await this.page.click(f.selectors.filterFieldCss);
            await this.page.keyboard.type(String(value));
            // Trigger change events
            await this.page.evaluate((selector) => {
                const field = document.querySelector(selector);
                if (field) {
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, f.selectors.filterFieldCss);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Filter \${fieldName} set to: \${value}\`
                }
            ]
        };
    }

    async executeAction(action) {
        const all = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'all.json'), 'utf8'));
        const table = all.tables[0];
        if (!table) throw new Error('No table found');
        
        const actions = table.actions || [];
        const act = actions.find(a => a.id === action || a.text === action);
        if (!act) throw new Error('Action not found: ' + action);
        
        await this.page.click(act.selector);
        
        // Brief, bounded wait for any results (messages, object page, or form fields)
        try {
            await Promise.race([
                this.page.waitForFunction(() => {
                    const hasPopover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
                    const hasMsgBox = document.querySelector('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog');
                    const hasObject = document.querySelector('.sapUxAPObjectPageLayout, .sapFeCoreObjectPage, [id*="ObjectPage"]');
                    const hasForm = document.querySelector('[id*="::Field-edit"], input[id*="-inner"]');
                    return Boolean(hasPopover || hasMsgBox || hasObject || hasForm);
                }, { timeout: 1200 }),
                this.page.waitForTimeout(800)
            ]);
        } catch (e) { /* ignore */ }

        const messages = await this.page.evaluate(() => {
            const collected = [];

            // Message Popover variant
            const popover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
            if (popover) {
                const items = popover.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                items.forEach((li) => {
                    const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('a, span');
                    const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                    const cls = li.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    if (text) collected.push({ severity, text });
                });
            }

            // MessageBox/Dialog variant
            const dialogs = Array.from(document.querySelectorAll('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog'));
            dialogs.forEach((dlg) => {
                const boxText = dlg.querySelector('.sapMFT, .sapMMsgBoxText, [id$="-title"], [id$="-title-inner"]');
                const text = (boxText?.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (text) {
                    const cls = dlg.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    collected.push({ severity, text });
                }
            });

            return collected;
        });

        if (Array.isArray(messages) && messages.length > 0) {
            return {
                content: [
                    { type: 'text', text: 'Action executed with messages' },
                    { type: 'text', text: JSON.stringify({ action, scenario: 'error_messages', messages }, null, 2) }
                ]
            };
        }

        // Detect dialog/form or opened form on page and return fields
        const scenario = await this.page.evaluate(() => {
            const dialog = document.querySelector('.sapMDialog.sapMDialogOpen');
            if (dialog) {
                const hasForm = dialog.querySelector('form, .sapUiForm, input[type="text"], .sapMInputBase');
                const hasFooter = dialog.querySelector('.sapMDialogFooter');
                if (hasForm && hasFooter) return { type: 'popup_dialog' };
            }
            const objectPage = document.querySelector('.sapUxAPObjectPageLayout, .sapFeCoreObjectPage, [id*="ObjectPage"]');
            const formFields = document.querySelector('[id*="::Field-edit"], input[id*="-inner"], .sapMInputBase');
            if (objectPage || formFields) return { type: 'form_opened' };
            return { type: 'action_completed' };
        });

        if (scenario.type === 'popup_dialog') {
            const dialogFields = await this.page.evaluate(() => {
                const dialog = document.querySelector('.sapMDialog.sapMDialogOpen');
                if (!dialog) return [];
                const fields = [];
                const inputs = dialog.querySelectorAll('input[type="text"], .sapMInputBase input, textarea');
                inputs.forEach((input, index) => {
                    const label = dialog.querySelector('label[for="' + input.id + '"]') || input.closest('.sapUiFormElement')?.querySelector('.sapMLabel') || input.previousElementSibling;
                    const labelText = (label?.textContent || '').replace(/\u00A0/g, ' ').trim() || ('Field ' + (index + 1));
                    fields.push({ id: input.id || ('dialog-field-' + index), label: labelText, value: input.value || '', type: input.type || 'text', selector: input.id ? ('#' + CSS.escape(input.id)) : ('input:nth-of-type(' + (index + 1) + ')') });
                });
                return fields;
            });
            return {
                content: [
                    { type: 'text', text: 'Action opened popup dialog' },
                    { type: 'text', text: JSON.stringify({ action, scenario: 'popup_dialog', formFields: dialogFields }, null, 2) }
                ]
            };
        }

        if (scenario.type === 'form_opened') {
            const formFields = await this.page.evaluate(() => {
                const fields = [];
                const inputs = document.querySelectorAll('[id*="::Field-edit"], input[id*="-inner"], .sapMInputBase input, textarea');
                inputs.forEach((input, index) => {
                    const label = document.querySelector('label[for="' + input.id + '"]') || input.closest('.sapUiFormCLElement')?.querySelector('.sapMLabel') || input.previousElementSibling;
                    const labelText = (label?.textContent || '').replace(/\u00A0/g, ' ').trim() || ('Field ' + (index + 1));
                    fields.push({ id: input.id || ('form-field-' + index), label: labelText, value: input.value || '', type: input.type || 'text', selector: input.id ? ('#' + CSS.escape(input.id)) : ('input:nth-of-type(' + (index + 1) + ')') });
                });
                return fields;
            });
            return {
                content: [
                    { type: 'text', text: 'Action opened form' },
                    { type: 'text', text: JSON.stringify({ action, scenario: 'form_opened', formFields }, null, 2) }
                ]
            };
        }

        return {
            content: [
                { type: 'text', text: 'Action executed successfully' },
                { type: 'text', text: JSON.stringify({ action, scenario: 'action_completed' }, null, 2) }
            ]
        };
    }

    async selectRow(rowIndex) {
        const table = this.page.locator("table[id$='-innerTable-listUl']");
        await table.waitFor();
        const rows = table.locator('tbody tr.sapMListTblRow');
        const row = rows.nth(Math.max(0, rowIndex));
        const checkbox = row.locator("td[id$='-ModeCell'] [role='checkbox']");
        
        await checkbox.click();
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Row \${rowIndex} selected\`
                }
            ]
        };
    }

    async openObjectPage(rowIndex) {
        const table = this.page.locator("table[id$='-innerTable-listUl']");
        await table.waitFor();
        const rows = table.locator('tbody tr.sapMListTblRow');
        const row = rows.nth(Math.max(0, rowIndex));
        const navIcon = row.locator('td.sapMListTblNavCol .sapMLIBImgNav');
        
        await navIcon.click();
        
        await Promise.race([
            this.page.waitForSelector('.sapUxAPObjectPageLayout', { timeout: 60000 }),
            this.page.waitForFunction(() => window.location.hash.includes('ObjectPage'), { timeout: 60000 })
        ]);
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Object page opened for row \${rowIndex}\`
                }
            ]
        };
    }

    async getObjectActions() {
        const actions = await this.page.evaluate(() => {
            const results = [];
            const containers = Array.from(document.querySelectorAll('[id$="--fe::ObjectPageDynamicHeaderTitle-mainActions"], .sapFDynamicPageTitleMainActions'));
            
            containers.forEach((container) => {
                const buttons = Array.from(container.querySelectorAll('button'));
                buttons.forEach((btn) => {
                    // Exclude internal chrome buttons like __button6-internalBtn
                    if (btn.id && /__button\d+-internalBtn/.test(btn.id)) return;
                    const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
                    if (text) {
                        results.push({
                            id: btn.id,
                            text: text,
                            selector: '#' + CSS.escape(btn.id)
                        });
                    }
                });
            });
            
            return results;
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ actions }, null, 2)
                }
            ]
        };
    }

    async getTableActions() {
        const actions = await this.page.evaluate(() => {
            const results = [];
            const toolbars = Array.from(document.querySelectorAll('[id$="-toolbar"], .sapMTB.sapMOTB'));
            const guessRequiresSelectionByText = (txt) => {
                const t = (txt || '').toLowerCase();
                // Common FE actions that typically require a row selection
                return t.includes('delete') || t.includes('update') || t.includes('copy') || t.includes('edit') || t.includes('open') || t.includes('share');
            };
            toolbars.forEach((tb) => {
                const buttons = Array.from(tb.querySelectorAll('button'));
                buttons.forEach((btn) => {
                    // Exclude internal chrome buttons like __button6-internalBtn
                    if (btn.id && /__button\d+-internalBtn/.test(btn.id)) return;
                    const text = (btn.textContent || btn.getAttribute('aria-label') || '').replace(/\u00A0/g, ' ').trim();
                    if (!text) return;
                    const disabled = btn.hasAttribute('disabled') || btn.classList.contains('sapMBtnDisabled');
                    const requiresSelectionLikely = disabled ? guessRequiresSelectionByText(text) : false;
                    results.push({
                        id: btn.id,
                        text,
                        selector: '#' + CSS.escape(btn.id),
                        enabled: !disabled,
                        requiresSelectionLikely
                    });
                });
            });
            return results;
        });

        return {
            content: [
                { type: 'text', text: JSON.stringify({ actions }, null, 2) }
            ]
        };
    }

    async executeTableAction(action) {
        const target = (action || '').toLowerCase().trim();
        const selectors = [
            // Exact text/aria-label on toolbar buttons
            'div[role="toolbar"] button:has-text("' + action + '")',
            'div[role="toolbar"] button[aria-label*="' + action + '"]',
            // FE standard action IDs
            'button[id*="::StandardAction::' + action + '"]',
            'button[id*="::StandardAction::' + (action.charAt(0).toUpperCase() + action.slice(1).toLowerCase()) + '"]',
            // Fallback: any button with text
            'button:has-text("' + action + '")'
        ];

        for (const sel of selectors) {
            try {
                const el = await this.page.$(sel);
                if (el) {
                    await el.click();
                    
                    // Wait for UI changes and detect scenario
                    await this.page.waitForTimeout(500); // Brief pause for UI to react
                    
                    // Check for different scenarios in order of priority
                    const scenario = await this.page.evaluate(() => {
                        // Scenario 1: Standard popup dialog (sapMDialog with form)
                        const dialog = document.querySelector('.sapMDialog.sapMDialogOpen');
                        if (dialog) {
                            const hasForm = dialog.querySelector('form, .sapUiForm, input[type="text"], .sapMInputBase');
                            const hasFooter = dialog.querySelector('.sapMDialogFooter');
                            if (hasForm && hasFooter) {
                                return { type: 'popup_dialog', dialog: dialog.id || 'unknown' };
                            }
                        }
                        
                        // Scenario 2: Error messages (various types)
                        const errorPopover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
                        const errorDialog = document.querySelector('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog');
                        const errorStrip = document.querySelector('.sapMMessageStrip');
                        if (errorPopover || errorDialog || errorStrip) {
                            return { type: 'error_messages' };
                        }
                        
                        // Scenario 3: Form opened (object page or standalone form)
                        const objectPage = document.querySelector('.sapUxAPObjectPageLayout, .sapFeCoreObjectPage, [id*="ObjectPage"]');
                        const formFields = document.querySelector('[id*="::Field-edit"], input[id*="-inner"], .sapMInputBase');
                        if (objectPage || formFields) {
                            return { type: 'form_opened' };
                        }
                        
                        // Scenario 4: Action executed, nothing changed
                        return { type: 'action_completed' };
                    });
                    
                    // Handle each scenario appropriately
                    if (scenario.type === 'popup_dialog') {
                        // Get dialog form fields
                        const dialogFields = await this.page.evaluate(() => {
                            const dialog = document.querySelector('.sapMDialog.sapMDialogOpen');
                            if (!dialog) return [];
                            
                            const fields = [];
                            const inputs = dialog.querySelectorAll('input[type="text"], .sapMInputBase input, textarea');
                            inputs.forEach((input, index) => {
                                const label = dialog.querySelector('label[for="' + input.id + '"]') || 
                                            input.closest('.sapUiFormElement')?.querySelector('.sapMLabel') ||
                                            input.previousElementSibling;
                                const labelText = label?.textContent?.replace(/\u00A0/g, ' ').trim() || ('Field ' + (index + 1));
                                
                                fields.push({
                                    id: input.id || ('dialog-field-' + index),
                                    label: labelText,
                                    value: input.value || '',
                                    type: input.type || 'text',
                                    selector: input.id ? '#' + CSS.escape(input.id) : ('input:nth-of-type(' + (index + 1) + ')')
                                });
                            });
                            return fields;
                        });
                        
                        return {
                            content: [
                                { type: 'text', text: 'Action opened popup dialog' },
                                { type: 'text', text: JSON.stringify({ 
                                    action, 
                                    scenario: 'popup_dialog',
                                    dialogId: scenario.dialog,
                                    formFields: dialogFields 
                                }, null, 2) }
                            ]
                        };
                    }
                    
                    if (scenario.type === 'error_messages') {
                        // Collect error messages
                        const messages = await this.page.evaluate(() => {
                            const collected = [];
                            
                            // Message Popover variant
                            const popover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
                            if (popover) {
                                const items = popover.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                                items.forEach((li) => {
                                    const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('#__item24-titleText, #__item26-titleText, a, span');
                                    const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                                    const cls = li.className || '';
                                    let severity = 'Information';
                                    if (cls.includes('Error')) severity = 'Error';
                                    else if (cls.includes('Warning')) severity = 'Warning';
                                    else if (cls.includes('Success')) severity = 'Success';
                                    if (text) collected.push({ severity, text });
                                });
                            }
                            
                            // MessageBox/Dialog variant
                            const dialogs = Array.from(document.querySelectorAll('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog'));
                            dialogs.forEach((dlg) => {
                                const boxText = dlg.querySelector('.sapMFT, .sapMMsgBoxText, [id$="-title"], [id$="-title-inner"]');
                                const text = (boxText?.textContent || '').replace(/\u00A0/g, ' ').trim();
                                if (text) {
                                    const cls = dlg.className || '';
                                    let severity = 'Information';
                                    if (cls.includes('Error')) severity = 'Error';
                                    else if (cls.includes('Warning')) severity = 'Warning';
                                    else if (cls.includes('Success')) severity = 'Success';
                                    collected.push({ severity, text });
                                }
                            });
                            
                            // Message Strips
                            const strips = Array.from(document.querySelectorAll('.sapMMessageStrip'));
                            strips.forEach((strip) => {
                                const text = (strip.textContent || '').replace(/\u00A0/g, ' ').trim();
                                if (!text) return;
                                const cls = strip.className || '';
                                let severity = 'Information';
                                if (cls.includes('Error')) severity = 'Error';
                                else if (cls.includes('Warning')) severity = 'Warning';
                                else if (cls.includes('Success')) severity = 'Success';
                                collected.push({ severity, text });
                            });
                            
                            return collected;
                        });
                        
                        return {
                            content: [
                                { type: 'text', text: 'Action executed with error messages' },
                                { type: 'text', text: JSON.stringify({ 
                                    action, 
                                    scenario: 'error_messages',
                                    messages 
                                }, null, 2) }
                            ]
                        };
                    }
                    
                    if (scenario.type === 'form_opened') {
                        // Get form fields from the opened form
                        const formFields = await this.page.evaluate(() => {
                            const fields = [];
                            const inputs = document.querySelectorAll('[id*="::Field-edit"], input[id*="-inner"], .sapMInputBase input, textarea');
                            inputs.forEach((input, index) => {
                                const label = document.querySelector('label[for="' + input.id + '"]') || 
                                            input.closest('.sapUiFormCLElement')?.querySelector('.sapMLabel') ||
                                            input.previousElementSibling;
                                const labelText = label?.textContent?.replace(/\u00A0/g, ' ').trim() || ('Field ' + (index + 1));
                                
                                fields.push({
                                    id: input.id || ('form-field-' + index),
                                    label: labelText,
                                    value: input.value || '',
                                    type: input.type || 'text',
                                    selector: input.id ? '#' + CSS.escape(input.id) : ('input:nth-of-type(' + (index + 1) + ')')
                                });
                            });
                            return fields;
                        });
                        
                        return {
                            content: [
                                { type: 'text', text: 'Action opened form' },
                                { type: 'text', text: JSON.stringify({ 
                                    action, 
                                    scenario: 'form_opened',
                                    formFields 
                                }, null, 2) }
                            ]
                        };
                    }
                    
                    // Scenario 4: Action completed, nothing changed
                    return {
                        content: [
                            { type: 'text', text: 'Action executed successfully' },
                            { type: 'text', text: JSON.stringify({ 
                                action, 
                                scenario: 'action_completed' 
                            }, null, 2) }
                        ]
                    };
                }
            } catch (e) {
                // try next selector
            }
        }

        return {
            content: [
                { type: 'text', text: 'Action not found on toolbar: ' + action }
            ]
        };
    }

    async executeDialogAction(action) {
        const target = (action || '').toLowerCase().trim();
        if (!target) {
            throw new Error('Dialog action is required');
        }

        const clicked = await this.page.evaluate((actionName) => {
            try {
                const targetLc = (actionName || '').toLowerCase().trim();
                const dialog = document.querySelector('.sapMDialog.sapMDialogOpen');
                if (!dialog) return { success: false, reason: 'No open dialog' };

                function getButtonText(btn) {
                    const bdi = btn.querySelector('bdi');
                    const inner = btn.textContent || '';
                    const aria = btn.getAttribute('aria-label') || '';
                    const bdiText = bdi ? (bdi.textContent || '') : '';
                    return (bdiText || inner || aria).replace(/\u00A0/g, ' ').trim();
                }

                const buttons = Array.from(dialog.querySelectorAll('footer button, .sapMDialogFooter button, button'));
                let match = null;
                for (const btn of buttons) {
                    const txt = getButtonText(btn).toLowerCase();
                    if (!txt) continue;
                    if (txt === targetLc || txt.includes(targetLc)) { match = btn; break; }
                }
                if (!match) return { success: false, reason: 'Button not found' };

                const ctrl = window.sap?.ui?.getCore?.().byId(match.id);
                if (ctrl && typeof ctrl.firePress === 'function') {
                    ctrl.firePress();
                } else {
                    match.click();
                }
                return { success: true, buttonId: match.id };
            } catch (e) {
                return { success: false, reason: e.message || 'Click failed' };
            }
        }, action);

        if (!clicked || !clicked.success) {
            return {
                content: [
                    { type: 'text', text: 'Dialog action failed: ' + (clicked?.reason || 'unknown') }
                ]
            };
        }

        try {
            await Promise.race([
                this.page.waitForFunction(() => !document.querySelector('.sapMDialog.sapMDialogOpen'), { timeout: 2000 }),
                this.page.waitForSelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView, .sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog', { timeout: 2000 }),
                this.page.waitForTimeout(1200)
            ]);
        } catch (e) {}

        const messages = await this.page.evaluate(() => {
            const collected = [];

            const popover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
            if (popover) {
                const items = popover.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                items.forEach((li) => {
                    const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('a, span');
                    const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                    const cls = li.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    if (text) collected.push({ severity, text });
                });
            }

            const dialogs = Array.from(document.querySelectorAll('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog'));
            dialogs.forEach((dlg) => {
                const boxText = dlg.querySelector('.sapMFT, .sapMMsgBoxText, [id$="-title"], [id$="-title-inner"]');
                const text = (boxText?.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (text) {
                    const cls = dlg.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    collected.push({ severity, text });
                }
            });

            const strips = Array.from(document.querySelectorAll('.sapMMessageStrip'));
            strips.forEach((strip) => {
                const text = (strip.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (!text) return;
                const cls = strip.className || '';
                let severity = 'Information';
                if (cls.includes('Error')) severity = 'Error';
                else if (cls.includes('Warning')) severity = 'Warning';
                else if (cls.includes('Success')) severity = 'Success';
                collected.push({ severity, text });
            });

            const toast = document.querySelector('.sapUiMessageToast');
            if (toast) {
                const text = (toast.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (text) collected.push({ severity: 'Information', text });
            }

            return collected;
        });

        if (messages && messages.length > 0) {
            return {
                content: [
                    { type: 'text', text: 'Dialog action executed with messages' },
                    { type: 'text', text: JSON.stringify({ action, messages }, null, 2) }
                ]
            };
        }

        return {
            content: [
                { type: 'text', text: 'Dialog action executed: ' + action }
            ]
        };
    }

    async getClickableElements() {
        const elements = await this.page.evaluate(() => {
            function isVisible(el) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            }
            function buildSelector(el) {
                if (el.id) return '#' + CSS.escape(el.id);
                const aria = el.getAttribute('aria-label');
                const role = el.getAttribute('role');
                const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (aria) return el.tagName.toLowerCase() + '[aria-label*="' + (window.CSS && CSS.escape ? CSS.escape(aria) : aria) + '"]';
                if (role && text) return '[role="' + role + '"]' + ':has-text("' + text + '")';
                if (text) return el.tagName.toLowerCase() + ':has-text("' + text + '")';
                return '';
            }

            const clickable = [];
            const candidates = Array.from(document.querySelectorAll('button, [role="button"], a, .sapMBtn, .sapMBtnBase'));
            candidates.forEach((el) => {
                if (!isVisible(el)) return;
                const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (!text) return;
                const enabled = !el.hasAttribute('disabled') && !el.classList.contains('sapMBtnDisabled');
                clickable.push({
                    id: el.id || '',
                    text,
                    tag: el.tagName.toLowerCase(),
                    role: el.getAttribute('role') || '',
                    enabled,
                    selector: buildSelector(el)
                });
            });
            return clickable;
        });
        return {
            content: [
                { type: 'text', text: JSON.stringify({ elements }, null, 2) }
            ]
        };
    }

    async highlightElement(selector, durationMs) {
        const ok = await this.page.evaluate(async ({ sel, ms }) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const prev = el.style.outline;
            el.style.outline = '3px solid #FF8C00';
            await new Promise(r => setTimeout(r, typeof ms === 'number' ? ms : 1500));
            el.style.outline = prev;
            return true;
        }, { sel: selector, ms: durationMs });
        if (!ok) {
            return { content: [{ type: 'text', text: 'Element not found: ' + selector }] };
        }
        return { content: [{ type: 'text', text: 'Element highlighted: ' + selector }] };
    }

    async clickBySelector(selector) {
        const result = await this.page.evaluate((sel) => {
            try {
                const el = document.querySelector(sel);
                if (!el) return { success: false, reason: 'Element not found' };
                const id = el.id;
                const ctrl = id ? (window.sap?.ui?.getCore?.().byId(id)) : null;
                if (ctrl && typeof ctrl.firePress === 'function') {
                    ctrl.firePress();
                } else {
                    el.click();
                }
                return { success: true, id: id || '' };
            } catch (e) {
                return { success: false, reason: e.message || 'Click failed' };
            }
        }, selector);

        if (!result || !result.success) {
            return { content: [{ type: 'text', text: 'Click failed: ' + (result?.reason || 'unknown') }] };
        }

        // small wait to allow UI to react
        await this.page.waitForTimeout(300);
        return { content: [{ type: 'text', text: 'Clicked element: ' + (result.id || selector) }] };
    }

    async typeBySelector(selector, value) {
        const result = await this.page.evaluate(({ sel, val }) => {
            try {
                const el = document.querySelector(sel);
                if (!el) return { success: false, reason: 'Element not found' };
                if (!['INPUT', 'TEXTAREA'].includes(el.tagName)) {
                    return { success: false, reason: 'Element is not an input or textarea' };
                }
                el.focus();
                el.select();
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, id: el.id || '' };
            } catch (e) {
                return { success: false, reason: e.message || 'Type failed' };
            }
        }, { sel: selector, val: value });

        if (!result || !result.success) {
            return { content: [{ type: 'text', text: 'Type failed: ' + (result?.reason || 'unknown') }] };
        }

        return { content: [{ type: 'text', text: 'Typed "' + value + '" into: ' + (result.id || selector) }] };
    }

    async waitForSelector(selector, timeoutMs) {
        try {
            await this.page.waitForSelector(selector, { timeout: timeoutMs || 5000 });
            return { content: [{ type: 'text', text: 'Element appeared: ' + selector }] };
        } catch (e) {
            return { content: [{ type: 'text', text: 'Timeout waiting for: ' + selector }] };
        }
    }

    async waitForMissingSelector(selector, timeoutMs) {
        try {
            await this.page.waitForFunction((sel) => !document.querySelector(sel), { timeout: timeoutMs || 5000 }, selector);
            return { content: [{ type: 'text', text: 'Element disappeared: ' + selector }] };
        } catch (e) {
            return { content: [{ type: 'text', text: 'Timeout waiting for element to disappear: ' + selector }] };
        }
    }

    async getMessages() {
        const messages = await this.page.evaluate(() => {
            const collected = [];

            // Message Popover variant
            const popover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
            if (popover) {
                const items = popover.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                items.forEach((li) => {
                    const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('a, span');
                    const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                    const cls = li.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    if (text) collected.push({ type: 'popover', severity, text });
                });
            }

            // MessageBox/Dialog variant (includes alertdialog like Delete/Cancel confirmations)
            const dialogs = Array.from(document.querySelectorAll('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog'));
            dialogs.forEach((dlg) => {
                const titleEl = dlg.querySelector('#' + dlg.id + '-title-inner, [id$="-title"], [id$="-title-inner"]');
                const title = (titleEl?.textContent || '').replace(/\u00A0/g, ' ').trim() || 'Dialog';
                const textEl = dlg.querySelector('.sapMFT, .sapMMsgBoxText, .sapMDialogScrollCont, section, .sapMText');
                const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                const cls = dlg.className || '';
                let severity = 'Information';
                if (cls.includes('Error')) severity = 'Error';
                else if (cls.includes('Warning')) severity = 'Warning';
                else if (cls.includes('Success')) severity = 'Success';

                // Collect actionable buttons in footer (e.g., Delete / Cancel)
                const buttons = Array.from(dlg.querySelectorAll('footer button, .sapMDialogFooter button'))
                    .map((btn) => {
                        const id = btn.id || '';
                        const textNode = btn.querySelector('bdi, .sapMBtnContent, span, .sapMBtnText');
                        const btnText = (textNode?.textContent || btn.getAttribute('aria-label') || '').replace(/\u00A0/g, ' ').trim();
                        return {
                            text: btnText,
                            selector: id ? ('#' + id) : null,
                        };
                    })
                    .filter(b => b.text);

                collected.push({ type: 'dialog', severity, title, text, buttons });
            });

            // Also surface any open generic UI5 dialog with footer actions (not only message boxes)
            const openDialogs = Array.from(document.querySelectorAll('.sapMDialog.sapMDialogOpen'));
            openDialogs.forEach((dlg) => {
                const titleEl = dlg.querySelector('#' + dlg.id + '-title-inner, [id$="-title"], [id$="-title-inner"]');
                const title = (titleEl?.textContent || '').replace(/\u00A0/g, ' ').trim() || 'Dialog';
                const textEl = dlg.querySelector('.sapMDialogScrollCont, section, .sapMText');
                const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                const buttons = Array.from(dlg.querySelectorAll('footer button, .sapMDialogFooter button'))
                    .map((btn) => {
                        const id = btn.id || '';
                        const textNode = btn.querySelector('bdi, .sapMBtnContent, span, .sapMBtnText');
                        const btnText = (textNode?.textContent || btn.getAttribute('aria-label') || '').replace(/\u00A0/g, ' ').trim();
                        return {
                            text: btnText,
                            selector: id ? ('#' + id) : null,
                        };
                    })
                    .filter(b => b.text);

                if (buttons.length || text) {
                    collected.push({ type: 'dialog', severity: 'Information', title, text, buttons });
                }
            });

            // Message Strips
            const strips = Array.from(document.querySelectorAll('.sapMMessageStrip'));
            strips.forEach((strip) => {
                const text = (strip.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (!text) return;
                const cls = strip.className || '';
                let severity = 'Information';
                if (cls.includes('Error')) severity = 'Error';
                else if (cls.includes('Warning')) severity = 'Warning';
                else if (cls.includes('Success')) severity = 'Success';
                collected.push({ type: 'strip', severity, text });
            });

            // Message Toasts
            const toast = document.querySelector('.sapUiMessageToast');
            if (toast) {
                const text = (toast.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (text) collected.push({ type: 'toast', severity: 'Information', text });
            }

            return collected;
        });

        return {
            content: [
                { type: 'text', text: JSON.stringify({ messages }, null, 2) }
            ]
        };
    }

    async recordFlowStart() {
        this.flowRecorder = { isRecording: true, steps: [] };
        return {
            content: [
                { type: 'text', text: 'Flow recording started' }
            ]
        };
    }

    async recordFlowStop() {
        const steps = [...this.flowRecorder.steps];
        this.flowRecorder = { isRecording: false, steps: [] };
        return {
            content: [
                { type: 'text', text: 'Flow recording stopped' },
                { type: 'text', text: JSON.stringify({ steps }, null, 2) }
            ]
        };
    }

    async getObjectFields() {
        // Ensure we are on an object page by checking common containers
        const isObjectPage = await this.page.evaluate(() => {
            return Boolean(document.querySelector('.sapUxAPObjectPageLayout, .sapFeCoreObjectPage, [id*="ObjectPage"]'));
        });
        if (!isObjectPage) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ fields: [], message: 'Not on an object page' }, null, 2) }]
            };
        }
        const fields = await this.page.evaluate(() => {
            const result = [];
            const debug = [];
            const norm = (s) => (s || '').replace(/\u00A0/g, ' ').trim();

            function readDisplayValue(container) {
                if (!container) return '';
                
                debug.push('\\nContainer: ' + container.tagName + ' id="' + container.id + '" class="' + container.className + '"');
                
                // If container is already a Field-display span, use it directly
                if (container.matches('[id$="::Field-display"]') && container.classList.contains('sapMText')) {
                    const empty = container.querySelector('.sapMEmptyIndicator');
                    if (empty) return '';
                    const value = norm(container.textContent || '');
                    debug.push('Direct Field-display span: "' + value + '"');
                    return value;
                }
                
                // Strategy 1: Look for UI5 display spans with specific patterns
                let display = container.querySelector('[id$="::Field-display"]');
                if (display) {
                    const empty = display.querySelector('.sapMEmptyIndicator');
                    if (empty) return '';
                    const value = norm(display.textContent || '');
                    debug.push('Found Field-display span: "' + value + '"');
                    return value;
                }
                
                // Strategy 2: Look for any span with sapMText class
                display = container.querySelector('.sapMText');
                if (display) {
                    const empty = display.querySelector('.sapMEmptyIndicator');
                    if (empty) return '';
                    const value = norm(display.textContent || '');
                    debug.push('Found sapMText span: "' + value + '"');
                    return value;
                }
                
                // Strategy 3: Look for any span element
                display = container.querySelector('span');
                if (display) {
                    const empty = display.querySelector('.sapMEmptyIndicator');
                    if (empty) return '';
                    const value = norm(display.textContent || '');
                    debug.push('Found any span: "' + value + '"');
                    return value;
                }
                
                // Strategy 4: Check for input/select elements
                const input = container.querySelector('input, textarea, select');
                if (input && input.value) {
                    const value = norm(input.value);
                    debug.push('Found input: "' + value + '"');
                    return value;
                }
                
                // Strategy 5: Use container's own text content
                const empty = container.querySelector('.sapMEmptyIndicator');
                if (empty) return '';
                const value = norm(container.textContent || '');
                debug.push('Using container text: "' + value + '"');
                return value;
            }

            function pushField(labelNode, valueContainer) {
                const label = norm((labelNode && labelNode.textContent) || '').replace(/[:：]$/, '');
                if (!label) return;
                debug.push('\\nProcessing field: "' + label + '"');
                const value = readDisplayValue(valueContainer);
                debug.push('Final value: "' + value + '"');
                result.push({ label, value });
            }

            // Strategy A: explicit label-control relationships
            const labels = Array.from(document.querySelectorAll('label[for]'));
            labels.forEach((lab) => {
                const forId = lab.getAttribute('for');
                const ctrl = forId ? document.getElementById(forId) : null;
                const container = ctrl || lab.parentElement || document.getElementById(\`\${forId}::Field-display\`) || document.querySelector(\`[id=\"\${CSS.escape(forId)}::Field-content\"]\`);
                pushField(lab, container);
            });

            // Strategy B: within form elements (dt/dd pairs) - improved for UI5 object pages
            const formElements = Array.from(document.querySelectorAll('.sapUiFormCLElement'));
            debug.push('\\nFound ' + formElements.length + ' form elements');
            formElements.forEach((fe) => {
                const lab = fe.querySelector('dt .sapMLabel, dt label, .sapMLabel');
                if (lab) {
                    // Look for the value in the dd element, specifically in Field-display spans
                    const dd = fe.querySelector('dd');
                    if (dd) {
                        // Try to find the Field-display span first
                        const displaySpan = dd.querySelector('[id$="::Field-display"]');
                        if (displaySpan) {
                            pushField(lab, displaySpan);
                        } else {
                            // Fallback to the dd element itself
                            pushField(lab, dd);
                        }
                    }
                }
            });

            // Deduplicate by label (keep last occurrence to prioritize object page fields)
            const seen = new Set();
            const unique = [];
            // Process in reverse order to keep object page fields over filter fields
            for (let i = result.length - 1; i >= 0; i--) {
                const f = result[i];
                const key = f.label.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                unique.unshift(f); // Add to beginning to maintain order
            }
            return { fields: unique, debug: debug.join('\\n') };
        });
        return {
            content: [{ type: 'text', text: JSON.stringify({ fields: fields.fields, debug: fields.debug }, null, 2) }]
        };
    }

    async executeObjectAction(actionName) {
        const clicked = await this.page.evaluate((actionName) => {
            const containers = Array.from(document.querySelectorAll('[id$="--fe::ObjectPageDynamicHeaderTitle-mainActions"], .sapFDynamicPageTitleMainActions'));
            
            for (const container of containers) {
                const buttons = Array.from(container.querySelectorAll('button'));
                for (const btn of buttons) {
                    const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
                    if (text.toLowerCase() === actionName.toLowerCase()) {
                        const ctrl = window.sap?.ui?.getCore?.().byId(btn.id);
                        if (ctrl && typeof ctrl.firePress === 'function') {
                            ctrl.firePress();
                        } else {
                            btn.click();
                        }
                        return true;
                    }
                }
            }
            return false;
        }, actionName);
        
        if (!clicked) {
            throw new Error(\`Object action not found: \${actionName}\`);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Object action \${actionName} executed\`
                }
            ]
        };
    }

    async fillFormField(fieldName, value) {
        // First, get all available form fields dynamically
        const fields = await this.page.evaluate(() => {
            const formFields = [];
            
            // Find all input fields in forms (excluding filter fields)
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea, select'))
                .filter(input => !input.id.includes('FilterField') && !input.closest('.sapUiMdcFilterBar, .sapMFilterBar'));
            
            inputs.forEach((input) => {
                const field = {
                    id: input.id,
                    name: input.name,
                    type: input.type || 'text',
                    required: input.required || false,
                    placeholder: input.placeholder || '',
                    value: input.value || '',
                    selector: input.id ? \`#\${CSS.escape(input.id)}\` : '',
                    label: '',
                    fieldName: ''
                };
                
                // Try to find the label for this field
                const label = input.getAttribute('aria-labelledby') ? 
                    document.getElementById(input.getAttribute('aria-labelledby')) : 
                    input.closest('.sapUiFormCLElement')?.querySelector('.sapMLabel') ||
                    input.previousElementSibling;
                
                if (label) {
                    const labelText = label.textContent?.trim() || '';
                    field.label = labelText.replace(/[:：]$/, ''); // Remove trailing colon
                    field.fieldName = field.label.toLowerCase().replace(/\\s+/g, '');
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
        const isObjectPage = await this.page.evaluate(() => {
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
            throw new Error(\`Field not found: \${fieldName}\`);
        }
        
        // Click, clear, and type into the specific input
        const targetSelector = matchedField.selector;
        await this.page.click(targetSelector, { force: true });
        const handle = await this.page.$(targetSelector);
        if (!handle) throw new Error(\`Input not interactable for: \${fieldName}\`);
        
        await handle.evaluate((input) => {
            if (input && typeof input.focus === 'function') input.focus();
            // Clear value in a UI-friendly way
            if (input && 'value' in input) {
                if (typeof input.select === 'function') input.select();
                else input.value = '';
            }
        });
        
        await this.page.keyboard.type(value);
        
        // Trigger events to ensure UI5 recognizes the change
        await handle.evaluate((input) => {
            if (input) {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Field \${matchedField.label || matchedField.fieldName} filled with: \${value}\`
                }
            ]
        };
    }

    async getFormFields() {
        const fields = await this.page.evaluate(() => {
            const formFields = [];
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea, select'))
                .filter(input => !input.id.includes('FilterField') && !input.closest('.sapUiMdcFilterBar, .sapMFilterBar'));
            inputs.forEach((input) => {
                const field = {
                    id: input.id,
                    name: input.name,
                    type: input.type || 'text',
                    required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
                    placeholder: input.placeholder || '',
                    value: input.value || '',
                    selector: input.id ? \`#\${CSS.escape(input.id)}\` : '',
                    label: '',
                    fieldName: ''
                };
                // Associated label
                const label = (input.getAttribute('aria-labelledby') && document.getElementById(input.getAttribute('aria-labelledby'))) ||
                              input.closest('.sapUiFormCLElement')?.querySelector('.sapMLabel') ||
                              document.querySelector(\`label[for=\"\${input.id}\"]\`);
                if (label) {
                    field.label = (label.textContent || '').trim().replace(/[:：]$/, '');
                }
                // Field name guess
                if (field.id) {
                    const idParts = field.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || field.id;
                    field.fieldName = (field.label || lastPart).toLowerCase().replace(/[-_\s]/g, '');
                } else {
                    field.fieldName = (field.label || '').toLowerCase().replace(/[-_\s]/g, '');
                }
                formFields.push(field);
            });
            return formFields;
        });
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ formFields: fields }, null, 2)
                }
            ]
        };
    }

    async getFilterFields() {
        const fields = await this.page.evaluate(() => {
            const filterFields = [];
            
            // Find all filter fields specifically in FilterBar
            const filterInputs = Array.from(document.querySelectorAll('.sapUiMdcFilterBar input, .sapMFilterBar input, [id*="FilterField"] input'));
            
            filterInputs.forEach((input) => {
                const field = {
                    id: input.id,
                    name: input.name,
                    type: input.type || 'text',
                    required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
                    placeholder: input.placeholder || '',
                    value: input.value || '',
                    selector: input.id ? \`#\${CSS.escape(input.id)}\` : '',
                    label: '',
                    fieldName: ''
                };
                
                // Try to find the label for this filter field
                const label = input.getAttribute('aria-labelledby') ? 
                    document.getElementById(input.getAttribute('aria-labelledby')) : 
                    input.closest('.sapUiMdcFilterField, .sapMFilterField')?.querySelector('label, .sapMLabel');
                
                if (label) {
                    const labelText = label.textContent?.trim() || '';
                    field.label = labelText.replace(/[:：]$/, ''); // Remove trailing colon
                    field.fieldName = field.label.toLowerCase().replace(/\\s+/g, '');
                }
                
                // Generate a field name from ID if no label found
                if (!field.fieldName && input.id) {
                    const idParts = input.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || input.id;
                    field.fieldName = lastPart.toLowerCase().replace(/[-_\s]/g, '');
                }
                
                filterFields.push(field);
            });
            
            return filterFields;
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ filterFields: fields }, null, 2)
                }
            ]
        };
    }

    async setFilter(propertyKey, value) {
        // First, get all available filters dynamically
        const path = require('path');
        const allJsonPath = path.join(__dirname, 'all.json');
        const all = JSON.parse(require('fs').readFileSync(allJsonPath, 'utf8'));
        
        // Normalize the search term for flexible matching
        const normalize = (str) => (str || '').toLowerCase().replace(/[-_\s]/g, '');
        const searchTerm = normalize(propertyKey);
        
        // Try to find the filter by multiple criteria
        let filter = all.filters.find(f => 
            normalize(f.propertyKey) === searchTerm ||
            normalize(f.label) === searchTerm ||
            normalize(f.propertyKey).includes(searchTerm) ||
            normalize(f.label).includes(searchTerm)
        );
        
        if (!filter) {
            // If not found, return available filters for user reference
            const availableFilters = all.filters.map(f => ({
                propertyKey: f.propertyKey,
                label: f.label
            }));
            
            return {
                content: [
                    {
                        type: 'text',
                        text: \`Filter not found: \${propertyKey}\\n\\nAvailable filters:\\n\${availableFilters.map(f => \`- \${f.propertyKey} (\${f.label})\`).join('\\n')}\\n\\nPlease use one of the property keys above.\`
                    }
                ]
            };
        }
        
        // Use the found filter's selectors
        if (filter.selectors.inputCss) {
            // Clear and fill the input field
            await this.page.fill(filter.selectors.inputCss, '');
            await this.page.fill(filter.selectors.inputCss, String(value));
            // Trigger change events
            await this.page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, filter.selectors.inputCss);
        } else if (filter.selectors.selectCss) {
            await this.page.click(filter.selectors.selectCss);
            await this.page.click(\`.sapMPopupCont li:has-text("\${value}")\`);
        } else {
            await this.page.click(filter.selectors.filterFieldCss);
            await this.page.keyboard.type(String(value));
            // Trigger change events
            await this.page.evaluate((selector) => {
                const field = document.querySelector(selector);
                if (field) {
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, filter.selectors.filterFieldCss);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Filter \${filter.label} (\${filter.propertyKey}) set to \${value}\`
                }
            ]
        };
    }

    async submitForm() {
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
        
        for (const selector of saveSelectors) {
            try {
                const button = await this.page.$(selector);
                if (button) {
                    await button.click();
                    // Brief wait for any validation/messages to render
                    await this.page.waitForTimeout(500);

                    // Detect UI5 Message Popover messages dynamically
                    const messages = await this.page.evaluate(() => {
                        const results = [];
                        const container = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
                        if (!container) return results;

                        const items = container.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                        items.forEach((li) => {
                            const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('a, span');
                            const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                            const cls = li.className || '';
                            let severity = 'Information';
                            if (cls.includes('Error')) severity = 'Error';
                            else if (cls.includes('Warning')) severity = 'Warning';
                            else if (cls.includes('Success')) severity = 'Success';
                            results.push({ severity, text });
                        });
                        return results;
                    });

                    if (Array.isArray(messages) && messages.length > 0) {
                    return {
                        content: [
                                { type: 'text', text: 'Form submission returned messages' },
                                { type: 'text', text: JSON.stringify({ messages }, null, 2) }
                            ]
                        };
                    }

                    return {
                        content: [
                            { type: 'text', text: 'Form submitted successfully' }
                        ]
                    };
                }
            } catch (e) {
                // Continue to next selector
            }
        }
        
        throw new Error('No submit button found');
    }

    async discardDraft() {
        const cancelSelectors = [
            'button[data-sap-ui*="StandardAction::Cancel"]',
            'button[data-sap-ui*="Cancel"]',
            'button[data-sap-ui*="cancel"]',
            '.sapMBtn:has-text("Discard Draft")',
            'button:has-text("Discard Draft")',
            '.sapMBtn:has-text("Cancel")',
            'button:has-text("Cancel")'
        ];

        for (const selector of cancelSelectors) {
            try {
                const button = await this.page.$(selector);
                if (button) {
                    await button.click();
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Draft discarded successfully'
                            }
                        ]
                    };
                }
            } catch (e) {
                // continue trying other selectors
            }
        }

        throw new Error('No discard/cancel button found');
    }

    async closeApp() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: 'Application closed'
                }
            ]
        };
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Fiori MCP Server running on stdio');
    }
}

// Start the server
const server = new FioriAppServer();
server.run().catch(console.error);
`;

        return serverCode;
    }

    generateToolMethods() {
        return `
    async startApp() {
        await this.ensureBrowserStarted();
        await this.page.goto(this.appMetadata.url);
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForFunction(() => {
            return window.sap && window.sap.ui && window.sap.ui.getCore && window.sap.ui.getCore().getConfiguration;
        }, { timeout: 30000 });
        
        return {
            content: [
                {
                    type: 'text',
                    text: 'Fiori application started successfully'
                }
            ]
        };
    }

    async pressGo() {
        const goSelectors = [
            'button[id$="-btnSearch"]',
            'button:has-text("Go")',
            '.sapMBtn:has-text("Go")',
            'button[data-sap-ui*="btnSearch"]',
            'button[aria-describedby*="btnSearch"]'
        ];
        
        for (const selector of goSelectors) {
            try {
                const button = await this.page.$(selector);
                if (button) {
                    await button.click();
                    await this.page.waitForTimeout(1000);
                    
                    // Check for "No data found" message
                    const noDataMessage = await this.page.$('.sapMText:has-text("No data found"), .sapMText:has-text("No Data Found")');
                    if (noDataMessage) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: 'Go button pressed, but no data found'
                                }
                            ]
                        };
                    }
                    
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Go button pressed, table data refreshed'
                            }
                        ]
                    };
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Go button not found');
    }

    async getTableRows() {
        const rows = await this.page.evaluate(() => {
            const tableRows = [];
            const table = document.querySelector('.sapMList, .sapMTable, [role="table"]');
            
            if (!table) return tableRows;
            
            const rows = Array.from(table.querySelectorAll('tr, .sapMListUl > li'));
            
            rows.forEach((row, index) => {
                const cells = Array.from(row.querySelectorAll('td, .sapMListUl > li > div'));
                const rowData = {};
                
                cells.forEach((cell, cellIndex) => {
                    const columnHeader = cell.getAttribute('data-sap-ui-column') || 
                                       cell.closest('th')?.textContent?.trim() || 
                                       \`column_\${cellIndex}\`;
                    
                    // Handle nested spans for currency fields
                    const valueElement = cell.querySelector('span') || cell;
                    const value = valueElement.textContent?.trim() || '';
                    
                    rowData[columnHeader] = value;
                });
                
                if (Object.keys(rowData).length > 0) {
                    tableRows.push(rowData);
                }
            });
            
            return tableRows;
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ rows }, null, 2)
                }
            ]
        };
    }

    async executeAction(action) {
        const all = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'all.json'), 'utf8'));
        const table = all.tables[0];
        if (!table) throw new Error('No table found');
        
        const actions = table.actions || [];
        const act = actions.find(a => a.id === action || a.text === action);
        if (!act) throw new Error('Action not found: ' + action);
        
        await this.page.click(act.selector);
        
        // Brief, bounded wait for any results (messages, object page, or form fields)
        try {
            await Promise.race([
                this.page.waitForFunction(() => {
                    const hasPopover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
                    const hasMsgBox = document.querySelector('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog');
                    const hasObject = document.querySelector('.sapUxAPObjectPageLayout, .sapFeCoreObjectPage, [id*="ObjectPage"]');
                    const hasForm = document.querySelector('[id*="::Field-edit"], input[id*="-inner"]');
                    return Boolean(hasPopover || hasMsgBox || hasObject || hasForm);
                }, { timeout: 1200 }),
                this.page.waitForTimeout(800)
            ]);
        } catch (e) { /* ignore */ }

        const messages = await this.page.evaluate(() => {
            const collected = [];

            // Message Popover variant
            const popover = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
            if (popover) {
                const items = popover.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                items.forEach((li) => {
                    const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('a, span');
                    const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                    const cls = li.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    if (text) collected.push({ severity, text });
                });
            }

            // MessageBox/Dialog variant
            const dialogs = Array.from(document.querySelectorAll('.sapMDialog.sapMMessageBox, .sapMDialogError, .sapMMessageDialog, .sapMMessageBoxError, [role="alertdialog"].sapMDialog'));
            dialogs.forEach((dlg) => {
                const boxText = dlg.querySelector('.sapMFT, .sapMMsgBoxText, [id$="-title"], [id$="-title-inner"]');
                const text = (boxText?.textContent || '').replace(/\u00A0/g, ' ').trim();
                if (text) {
                    const cls = dlg.className || '';
                    let severity = 'Information';
                    if (cls.includes('Error')) severity = 'Error';
                    else if (cls.includes('Warning')) severity = 'Warning';
                    else if (cls.includes('Success')) severity = 'Success';
                    collected.push({ severity, text });
                }
            });

            return collected;
        });

        if (Array.isArray(messages) && messages.length > 0) {
        return {
            content: [
                    { type: 'text', text: 'Action executed with messages' },
                    { type: 'text', text: JSON.stringify({ action, messages }, null, 2) }
                ]
            };
        }

        return {
            content: [
                { type: 'text', text: 'Action ' + action + ' executed successfully' }
            ]
        };
    }

    async selectRow(rowIndex) {
        const rows = await this.page.$$('.sapMListUl > li, tr[role="row"]');
        if (rowIndex >= rows.length) {
            throw new Error(\`Row index \${rowIndex} out of range\`);
        }
        
        await rows[rowIndex].click();
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Row \${rowIndex} selected\`
                }
            ]
        };
    }

    async openObjectPage(rowIndex) {
        await this.selectRow(rowIndex);
        
        // Look for object page navigation elements
        const objectPageSelectors = [
            '.sapMListUl > li:has(.sapMLink)',
            'tr:has(.sapMLink)',
            '.sapMListUl > li:has(a)',
            'tr:has(a)'
        ];
        
        for (const selector of objectPageSelectors) {
            try {
                const element = await this.page.$(selector);
                if (element) {
                    const link = await element.$('a, .sapMLink');
                    if (link) {
                        await link.click();
                        await this.page.waitForLoadState('networkidle');
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: \`Object page opened for row \${rowIndex}\`
                                }
                            ]
                        };
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Could not open object page');
    }

    async getObjectActions() {
        const actions = await this.page.evaluate(() => {
            const results = [];
            const containers = Array.from(document.querySelectorAll('[id$="--fe::ObjectPageDynamicHeaderTitle-mainActions"], .sapFDynamicPageTitleMainActions'));
            
            containers.forEach((container) => {
                const buttons = Array.from(container.querySelectorAll('button'));
                buttons.forEach((btn) => {
                    // Exclude internal chrome buttons like __button6-internalBtn
                    if (btn.id && /__button\d+-internalBtn/.test(btn.id)) return;
                    const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
                    if (text) {
                        results.push({
                            id: btn.id,
                            text: text,
                            selector: '#' + CSS.escape(btn.id)
                        });
                    }
                });
            });
            
            return results;
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ actions }, null, 2)
                }
            ]
        };
    }

    async getObjectFields() {
        const result = await this.page.evaluate(() => {
            const fields = [];
            const debug = [];
            
            // Multiple strategies to find label/value pairs
            const strategies = [
                // Strategy 1: label[for] pattern
                () => {
                    const labels = Array.from(document.querySelectorAll('label[for]'));
                    return labels.map(label => {
                        const input = document.getElementById(label.getAttribute('for'));
                        return {
                            label: label.textContent?.trim().replace(/[:：]$/, ''),
                            value: input?.value || input?.textContent?.trim() || '',
                            container: label
                        };
                    });
                },
                
                // Strategy 2: dt/dd form elements
                () => {
                    const dts = Array.from(document.querySelectorAll('dt'));
                    return dts.map(dt => {
                        const dd = dt.nextElementSibling;
                        return {
                            label: dt.textContent?.trim().replace(/[:：]$/, ''),
                            value: dd?.textContent?.trim() || '',
                            container: dd
                        };
                    });
                },
                
                // Strategy 3: Common UI5 containers
                () => {
                    const containers = Array.from(document.querySelectorAll('.sapUiFormCLElement, .sapMObjectAttribute, .sapMObjectNumber'));
                    return containers.map(container => {
                        const label = container.querySelector('.sapMLabel, .sapMObjectAttributeTitle, .sapMObjectNumberText');
                        const value = container.querySelector('.sapMText, .sapMObjectAttributeText, .sapMObjectNumberValue');
                        return {
                            label: label?.textContent?.trim().replace(/[:：]$/, '') || '',
                            value: value?.textContent?.trim() || '',
                            container: container
                        };
                    });
                }
            ];
            
            // Try each strategy
            strategies.forEach((strategy, index) => {
                try {
                    const strategyResults = strategy();
                    strategyResults.forEach(field => {
                        if (field.label && field.container) {
                            fields.push(field);
                            debug.push(\`Strategy \${index + 1}: Found "\${field.label}" = "\${field.value}"\`);
                        }
                    });
                } catch (error) {
                    debug.push(\`Strategy \${index + 1} failed: \${error.message}\`);
                }
            });
            
            // Deduplicate by label (keep last occurrence - object page fields)
            const unique = [];
            const seen = new Set();
            
            // Process in reverse order to prioritize object page fields
            for (let i = fields.length - 1; i >= 0; i--) {
                const field = fields[i];
                if (!seen.has(field.label)) {
                    seen.add(field.label);
                    unique.unshift(field);
                }
            }
            
            return {
                fields: unique.map(f => ({ label: f.label, value: f.value })),
                debug: debug.join('\\n')
            };
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }

    async executeObjectAction(action) {
        const actions = await this.getObjectActions();
        const actionData = JSON.parse(actions.content[0].text);
        const act = actionData.actions.find(a => a.text === action || a.id === action);
        
        if (!act) {
            throw new Error(\`Object action not found: \${action}\`);
        }
        
        await this.page.click(act.selector);
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Object action \${action} executed successfully\`
                }
            ]
        };
    }

    async fillFormField(fieldName, value) {
        // First, get all available form fields dynamically
        const fields = await this.page.evaluate(() => {
            const formFields = [];
            
            // Find all input fields in forms (excluding filter fields)
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea, select'))
                .filter(input => !input.id.includes('FilterField') && !input.closest('.sapUiMdcFilterBar, .sapMFilterBar'));
            
            inputs.forEach((input) => {
                const field = {
                    id: input.id,
                    name: input.name,
                    type: input.type || 'text',
                    required: input.required || false,
                    placeholder: input.placeholder || '',
                    value: input.value || '',
                    selector: input.id ? \`#\${CSS.escape(input.id)}\` : '',
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
                    field.fieldName = field.label.toLowerCase().replace(/\\s+/g, '');
                }
                
                // Generate a field name from ID if no label found
                if (!field.fieldName && input.id) {
                    const idParts = input.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || input.id;
                    field.fieldName = lastPart.toLowerCase().replace(/[-_]/g, '');
                }
                
                formFields.push(field);
            });
            
            return formFields;
        });
        
        // Check if we're on object page to prioritize object page fields
        const isObjectPage = await this.page.evaluate(() => {
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
        }
        
        // If not on object page or no object page field found, try all fields
        if (!matchedField) {
            // Try to match by exact field name
            matchedField = fields.find(f => norm(f.fieldName) === target);
            
            // If not found, try to match by label
            if (!matchedField) {
                matchedField = fields.find(f => norm(f.label) === target);
            }
            
            // If still not found, try partial matching
            if (!matchedField) {
                matchedField = fields.find(f => 
                    norm(f.fieldName).includes(target) || 
                    norm(f.label).includes(target) ||
                    norm(f.id).includes(target)
                );
            }
        }
        
        if (!matchedField) {
            const availableFields = fields.map(f => \`\${f.label} (\${f.fieldName})\`).join(', ');
            throw new Error(\`Field not found: \${fieldName}. Available fields: \${availableFields}\`);
        }
        
        // Fill the field
        if (matchedField.selector) {
            await this.page.fill(matchedField.selector, '');
            await this.page.fill(matchedField.selector, String(value));
            
            // Trigger UI5 events
            await this.page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, matchedField.selector);
        } else {
            throw new Error(\`No selector found for field: \${fieldName}\`);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Field \${matchedField.label} (\${matchedField.fieldName}) filled with: \${value}\`
                }
            ]
        };
    }

    async getFormFields() {
        const fields = await this.page.evaluate(() => {
            const formFields = [];
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea, select'))
                .filter(input => !input.id.includes('FilterField') && !input.closest('.sapUiMdcFilterBar, .sapMFilterBar'));
            inputs.forEach((input) => {
                const field = {
                    id: input.id,
                    name: input.name,
                    type: input.type || 'text',
                    required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
                    placeholder: input.placeholder || '',
                    value: input.value || '',
                    selector: input.id ? \`#\${CSS.escape(input.id)}\` : '',
                    label: '',
                    fieldName: ''
                };
                // Associated label
                const label = (input.getAttribute('aria-labelledby') && document.getElementById(input.getAttribute('aria-labelledby'))) ||
                              input.closest('.sapUiFormCLElement')?.querySelector('label, .sapMLabel') ||
                              document.querySelector(\`label[for="\${input.id}"]\`);
                if (label) {
                    field.label = (label.textContent || '').trim().replace(/[:：]$/, '');
                }
                // Field name guess
                if (field.id) {
                    const idParts = field.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || field.id;
                    field.fieldName = (field.label || lastPart).toLowerCase().replace(/[-_\s]/g, '');
                } else {
                    field.fieldName = (field.label || '').toLowerCase().replace(/[-_\s]/g, '');
                }
                formFields.push(field);
            });
            return formFields;
        });
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ formFields: fields }, null, 2)
                }
            ]
        };
    }

    async getFilterFields() {
        const fields = await this.page.evaluate(() => {
            const filterFields = [];
            
            // Find all filter fields specifically in FilterBar
            const filterInputs = Array.from(document.querySelectorAll('.sapUiMdcFilterBar input, .sapMFilterBar input, [id*="FilterField"] input'));
            
            filterInputs.forEach((input) => {
                const field = {
                    id: input.id,
                    name: input.name,
                    type: input.type || 'text',
                    required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
                    placeholder: input.placeholder || '',
                    value: input.value || '',
                    selector: input.id ? \`#\${CSS.escape(input.id)}\` : '',
                    label: '',
                    fieldName: ''
                };
                
                // Try to find the label for this filter field
                const label = input.getAttribute('aria-labelledby') ? 
                    document.getElementById(input.getAttribute('aria-labelledby')) : 
                    input.closest('.sapUiMdcFilterField, .sapMFilterField')?.querySelector('label, .sapMLabel');
                
                if (label) {
                    const labelText = label.textContent?.trim() || '';
                    field.label = labelText.replace(/[:：]$/, ''); // Remove trailing colon
                    field.fieldName = field.label.toLowerCase().replace(/\\s+/g, '');
                }
                
                // Generate a field name from ID if no label found
                if (!field.fieldName && input.id) {
                    const idParts = input.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || input.id;
                    field.fieldName = lastPart.toLowerCase().replace(/[-_\s]/g, '');
                }
                
                filterFields.push(field);
            });
            
            return filterFields;
        });
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ filterFields: fields }, null, 2)
                }
            ]
        };
    }

    async setFilter(propertyKey, value) {
        // First, get all available filters dynamically
        const path = require('path');
        const allJsonPath = path.join(__dirname, 'all.json');
        const all = JSON.parse(require('fs').readFileSync(allJsonPath, 'utf8'));
        
        // Normalize the search term for flexible matching
        const normalize = (str) => (str || '').toLowerCase().replace(/[-_\s]/g, '');
        const searchTerm = normalize(propertyKey);
        
        // Try to find the filter by multiple criteria
        let filter = all.filters.find(f => 
            normalize(f.propertyKey) === searchTerm ||
            normalize(f.label) === searchTerm ||
            normalize(f.propertyKey).includes(searchTerm) ||
            normalize(f.label).includes(searchTerm)
        );
        
        if (!filter) {
            // If not found, return available filters for user reference
            const availableFilters = all.filters.map(f => ({
                propertyKey: f.propertyKey,
                label: f.label
            }));
            
            return {
                content: [
                    {
                        type: 'text',
                        text: \`Filter not found: \${propertyKey}\\n\\nAvailable filters:\\n\${availableFilters.map(f => \`- \${f.propertyKey} (\${f.label})\`).join('\\n')}\\n\\nPlease use one of the property keys above.\`
                    }
                ]
            };
        }
        
        // Use the found filter's selectors
        if (filter.selectors.inputCss) {
            // Clear and fill the input field
            await this.page.fill(filter.selectors.inputCss, '');
            await this.page.fill(filter.selectors.inputCss, String(value));
            // Trigger change events
            await this.page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, filter.selectors.inputCss);
        } else if (filter.selectors.selectCss) {
            await this.page.click(filter.selectors.selectCss);
            await this.page.click(\`.sapMPopupCont li:has-text("\${value}")\`);
        } else {
            await this.page.click(filter.selectors.filterFieldCss);
            await this.page.keyboard.type(String(value));
            // Trigger change events
            await this.page.evaluate((selector) => {
                const field = document.querySelector(selector);
                if (field) {
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, filter.selectors.filterFieldCss);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: \`Filter \${filter.label} (\${filter.propertyKey}) set to \${value}\`
                }
            ]
        };
    }

    async submitForm() {
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
        
        for (const selector of saveSelectors) {
            try {
                const button = await this.page.$(selector);
                if (button) {
                    await button.click();
                    await this.page.waitForTimeout(500);
                    const messages = await this.page.evaluate(() => {
                        const results = [];
                        const container = document.querySelector('.sapMMsgView, [id$="messagePopover-popover-cont"], .sapMMessageView');
                        if (!container) return results;
                        const items = container.querySelectorAll('.sapMMsgViewItem, li.sapMMsgViewItem, li.sapMLIB');
                        items.forEach((li) => {
                            const textEl = li.querySelector('.sapMLnkText, .sapMSLITitleOnly, .sapMSLITitleOnly span, a .sapMLnkText') || li.querySelector('a, span');
                            const text = (textEl?.textContent || '').replace(/\u00A0/g, ' ').trim();
                            const cls = li.className || '';
                            let severity = 'Information';
                            if (cls.includes('Error')) severity = 'Error';
                            else if (cls.includes('Warning')) severity = 'Warning';
                            else if (cls.includes('Success')) severity = 'Success';
                            results.push({ severity, text });
                        });
                        return results;
                    });
                    if (Array.isArray(messages) && messages.length > 0) {
                    return {
                        content: [
                                { type: 'text', text: 'Form submission returned messages' },
                                { type: 'text', text: JSON.stringify({ messages }, null, 2) }
                            ]
                        };
                    }
                    return {
                        content: [
                            { type: 'text', text: 'Form submitted successfully' }
                        ]
                    };
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Submit button not found');
    }

    async closeApp() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: 'Application closed'
                }
            ]
        };
    }`;
    }

    generateHTTPMCPServer() {
        const serverCode = `#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

/**
 * Auto-generated MCP Server for Fiori App - HTTP Streamable Version
 * Generated for: ${this.url}
 * Generated at: ${new Date().toISOString()}
 */

class FioriAppHTTPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'fiori-app-http-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.browser = null;
        this.context = null;
        this.page = null;
        this.appMetadata = ${JSON.stringify(this.appMetadata, null, 8)};

        this.setupToolHandlers();
        this.setupHTTPServer();
    }

    async ensureBrowserStarted() {
        if (!this.browser) {
            const HEADLESS = (process.env.HEADLESS === '1' || process.env.HEADLESS === 'true');
            this.browser = await chromium.launch({ 
                headless: HEADLESS,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 }
            });
            this.page = await this.context.newPage();
        }
    }

    setupHTTPServer() {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                server: 'fiori-app-http-server',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            });
        });

        // MCP SSE endpoint
        this.app.get('/mcp', async (req, res) => {
            const transport = new SSEServerTransport('/mcp', res);
            await this.server.connect(transport);
        });

        // REST API endpoints for direct tool calls
        this.app.post('/api/tools/:toolName', async (req, res) => {
            try {
                const { toolName } = req.params;
                const args = req.body;
                
                const result = await this.handleToolCall(toolName, args);
                res.json(result);
            } catch (error) {
                res.status(500).json({ 
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // List available tools
        this.app.get('/api/tools', (req, res) => {
            const tools = [
                { name: 'start_app', description: 'Start the Fiori application' },
                { name: 'press_go', description: 'Press the Go button to refresh table data' },
                { name: 'get_table_rows', description: 'Get current table rows data' },
                { name: 'execute_action', description: 'Execute an action on the table' },
                { name: 'select_row', description: 'Select a specific row in the table' },
                { name: 'open_object_page', description: 'Open object page for a selected row' },
                { name: 'get_object_actions', description: 'Get available actions on object page' },
                { name: 'get_object_fields', description: 'Read object page field label/value pairs dynamically' },
                { name: 'execute_object_action', description: 'Execute an action on object page' },
                { name: 'fill_form_field', description: 'Fill a form field' },
                { name: 'get_form_fields', description: 'List available form fields on current page' },
                { name: 'get_filter_fields', description: 'List available filter fields in the filter bar' },
                { name: 'get_table_actions', description: 'Get available actions on the current table toolbar' },
                { name: 'execute_table_action', description: 'Execute an action on the current table toolbar' },
                { name: 'set_filter', description: 'Set a filter value by property key' },
                { name: 'submit_form', description: 'Submit the current form' },
                { name: 'discard_draft', description: 'Discard current draft (Cancel)' },
                { name: 'execute_dialog_action', description: 'Execute a button inside the currently open Fiori dialog (e.g., Update/Ok/Cancel)' },
                { name: 'get_clickable_elements', description: 'Discover visible clickable elements (buttons, links) with selectors. Returns array of elements with id, text, tag, role, enabled status, and CSS selector. Use this to find elements before clicking or highlighting them.' },
                { name: 'highlight_element', description: 'Temporarily highlight an element by CSS selector to visually confirm the target. Use this to verify you have the right element before clicking.' },
                { name: 'click_by_selector', description: 'Click an element by CSS selector (UI5-aware). Automatically uses UI5 firePress() if available, otherwise DOM click.' },
                { name: 'type_by_selector', description: 'Type/replace value in an input/textarea by CSS selector. Clears existing value and types new one.' },
                { name: 'wait_for_selector', description: 'Wait for an element to appear by CSS selector. Useful after clicking buttons that open dialogs or load content.' },
                { name: 'wait_for_missing_selector', description: 'Wait for an element to disappear by CSS selector. Useful after closing dialogs or completing actions.' },
                { name: 'get_messages', description: 'Collect UI5 messages (popovers, dialogs, strips, toasts) from the current page. Use this to check for error/success messages after actions. No parameters needed.' },
                { name: 'record_flow_start', description: 'Start recording a flow of actions. After starting, all subsequent actions will be recorded until you call record_flow_stop. No parameters needed.' },
                { name: 'record_flow_stop', description: 'Stop recording and return the recorded steps as JSON. Use this to capture a sequence of actions for reuse. No parameters needed.' },
                { name: 'close_app', description: 'Close the application' }
            ];
            res.json({ tools });
        });

        // Server info endpoint
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'fiori-app-http-server',
                version: '1.0.0',
                description: 'HTTP MCP Server for Fiori Applications',
                capabilities: ['tools'],
                transport: 'HTTP/SSE',
                endpoints: {
                    mcp: '/mcp',
                    health: '/health',
                    tools: '/api/tools',
                    toolCall: '/api/tools/:toolName'
                }
            });
        });
    }

    async handleToolCall(name, args) {
        switch (name) {
            case 'start_app':
                return await this.startApp();
            case 'press_go':
                return await this.pressGo();
            case 'get_table_rows':
                return await this.getTableRows();
            case 'execute_action':
                return await this.executeAction(args.action);
            case 'select_row':
                return await this.selectRow(args.rowIndex);
            case 'open_object_page':
                return await this.openObjectPage(args.rowIndex);
            case 'get_object_actions':
                return await this.getObjectActions();
            case 'get_object_fields':
                return await this.getObjectFields();
            case 'execute_object_action':
                return await this.executeObjectAction(args.action);
            case 'fill_form_field':
                return await this.fillFormField(args.fieldName, args.value);
            case 'get_form_fields':
                return await this.getFormFields();
            case 'get_filter_fields':
                return await this.getFilterFields();
            case 'set_filter':
                return await this.setFilter(args.propertyKey, args.value);
            case 'submit_form':
                return await this.submitForm();
            case 'discard_draft':
                return await this.discardDraft();
            case 'close_app':
                return await this.closeApp();
            default:
                throw new Error(\`Unknown tool: \${name}\`);
        }
    }

    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'start_app',
                        description: 'Start the Fiori application',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'press_go',
                        description: 'Press the Go button to refresh table data',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_table_rows',
                        description: 'Get current table rows data',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'execute_action',
                        description: 'Execute an action on the table',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Action name to execute'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'select_row',
                        description: 'Select a specific row in the table',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                rowIndex: {
                                    type: 'number',
                                    description: 'Row index to select (0-based)'
                                }
                            },
                            required: ['rowIndex']
                        }
                    },
                    {
                        name: 'open_object_page',
                        description: 'Open object page for a selected row',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                rowIndex: {
                                    type: 'number',
                                    description: 'Row index to open object page for (0-based)'
                                }
                            },
                            required: ['rowIndex']
                        }
                    },
                    {
                        name: 'get_object_actions',
                        description: 'Get available actions on object page',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_object_fields',
                        description: 'Read object page field label/value pairs dynamically',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'execute_object_action',
                        description: 'Execute an action on object page',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    description: 'Action name to execute'
                                }
                            },
                            required: ['action']
                        }
                    },
                    {
                        name: 'fill_form_field',
                        description: 'Fill a form field',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                fieldName: {
                                    type: 'string',
                                    description: 'Field name to fill'
                                },
                                value: {
                                    type: 'string',
                                    description: 'Value to fill'
                                }
                            },
                            required: ['fieldName', 'value']
                        }
                    },
                    {
                        name: 'get_form_fields',
                        description: 'List available form fields on current page',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'get_filter_fields',
                        description: 'List available filter fields in the filter bar',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'set_filter',
                        description: 'Set a filter value by property key',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                propertyKey: {
                                    type: 'string',
                                    description: 'The property key of the filter field'
                                },
                                value: {
                                    type: 'string',
                                    description: 'The value to set for the filter'
                                }
                            },
                            required: ['propertyKey', 'value']
                        }
                    },
                    {
                        name: 'submit_form',
                        description: 'Submit the current form',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    },
                    {
                        name: 'close_app',
                        description: 'Close the application',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return await this.handleToolCall(name, args);
        });
    }

    ${this.generateToolMethods()}

    async start(port = 3000) {
        this.app.listen(port, '0.0.0.0', () => {
            console.log(\`Fiori MCP HTTP Server running on port \${port}\`);
            console.log(\`MCP endpoint: http://localhost:\${port}/mcp\`);
            console.log(\`Health check: http://localhost:\${port}/health\`);
            console.log(\`API info: http://localhost:\${port}/api/info\`);
            console.log(\`Available tools: http://localhost:\${port}/api/tools\`);
        });
    }
}

// Start the server
const server = new FioriAppHTTPServer();
const port = process.env.PORT || 3000;
server.start(port);
`;

        return serverCode;
    }

    async generateServer(outputPath = './generated-fiori-mcp-server.js') {
        if (!this.appMetadata) {
            throw new Error('App must be analyzed first. Call analyzeApp() before generateServer()');
        }

        const serverCode = this.generateMCPServer();
        
        // Write the generated server to file
        fs.writeFileSync(outputPath, serverCode);
        
        // Make it executable
        fs.chmodSync(outputPath, '755');
        
        console.log(`MCP Server generated: ${outputPath}`);
        console.log(`App URL: ${this.url}`);
        console.log(`Filters found: ${this.appMetadata.filters.length}`);
        console.log(`Tables found: ${this.appMetadata.tables.length}`);
        
        return outputPath;
    }

    async generateBothServers() {
        if (!this.appMetadata) {
            throw new Error('App must be analyzed first. Call analyzeApp() before generateBothServers()');
        }

        // Generate stdio version
        const stdioCode = this.generateMCPServer();
        fs.writeFileSync('./generated-fiori-mcp-server.js', stdioCode);
        fs.chmodSync('./generated-fiori-mcp-server.js', '755');
        
        // Generate HTTP version
        const httpCode = this.generateHTTPMCPServer();
        fs.writeFileSync('./generated-fiori-mcp-http-server.js', httpCode);
        fs.chmodSync('./generated-fiori-mcp-http-server.js', '755');
        
        console.log('✅ Both MCP Servers generated successfully!');
        console.log('\\nGenerated files:');
        console.log('- ./generated-fiori-mcp-server.js (stdio version)');
        console.log('- ./generated-fiori-mcp-http-server.js (HTTP version)');
        console.log(`\\nApp URL: ${this.url}`);
        console.log(`Filters found: ${this.appMetadata.filters.length}`);
        console.log(`Tables found: ${this.appMetadata.tables.length}`);
        console.log('\\nTo use the servers:');
        console.log('1. Install dependencies: npm install @modelcontextprotocol/sdk playwright express cors');
        console.log('2. Run stdio server: node ./generated-fiori-mcp-server.js');
        console.log('3. Run HTTP server: node ./generated-fiori-mcp-http-server.js');
        console.log('4. HTTP server will be available at: http://localhost:3000/mcp');
        
        return {
            stdio: './generated-fiori-mcp-server.js',
            http: './generated-fiori-mcp-http-server.js'
        };
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// CLI usage
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: node generate-mcp-server.js <fiori-app-url> [--both]');
        console.log('  --both, -b: Generate both stdio and HTTP versions');
        console.log('Example: node generate-mcp-server.js "https://your-fiori-app.com/flp.html" --both');
        process.exit(1);
    }

    const url = args[0];
    const generateBoth = args.includes('--both') || args.includes('-b');

    const generator = new FioriMCPGenerator(url);
    
    try {
        await generator.analyzeApp();
        
        if (generateBoth) {
            await generator.generateBothServers();
        } else {
            await generator.generateServer();
        }
    } catch (error) {
        console.error('❌ Error generating MCP server:', error.message);
        process.exit(1);
    } finally {
        await generator.cleanup();
    }
}

if (require.main === module) {
    main();
}

module.exports = { FioriMCPGenerator };
