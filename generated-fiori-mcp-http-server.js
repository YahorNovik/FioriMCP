#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

/**
 * Auto-generated MCP Server for Fiori App - HTTP Streamable Version
 * Generated for: https://7ab63f61-d9c7-4bcf-9057-beead39881c1.abap-web.us10.hana.ondemand.com/sap/bc/adt/businessservices/odatav4/feap/C%C2%87u%C2%84C%C2%83%C2%84%C2%89C%C2%83xu%C2%88uHC%C2%87u%C2%84C%C2%8E%C2%8E%C2%8D%C2%82%C2%89%7Ds%C2%8E%C2%8D%C2%82s%C2%88%C2%86u%C2%8Ay%C2%80s%C2%83HC%C2%87%C2%86%C2%8AxC%C2%87u%C2%84C%C2%8E%C2%8E%C2%8D%C2%82%C2%89%7Ds%C2%8E%C2%8D%C2%82s%C2%88%C2%86u%C2%8Ay%C2%80s%C2%83HCDDDEC77nnmbWsmbhfUjY%60sXV777777nnmbi%5DsnmbshfUjY%60scH77DDDE77nnmbi%5DsnmbshfUjY%60scH/flp.html?sap-ui-xx-viewCache=false&sap-ui-language=EN&sap-client=100#app-preview
 * Generated at: 2025-10-03T15:11:11.535Z
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
        this.appMetadata = {
        "url": "https://7ab63f61-d9c7-4bcf-9057-beead39881c1.abap-web.us10.hana.ondemand.com/sap/bc/adt/businessservices/odatav4/feap/C%C2%87u%C2%84C%C2%83%C2%84%C2%89C%C2%83xu%C2%88uHC%C2%87u%C2%84C%C2%8E%C2%8E%C2%8D%C2%82%C2%89%7Ds%C2%8E%C2%8D%C2%82s%C2%88%C2%86u%C2%8Ay%C2%80s%C2%83HC%C2%87%C2%86%C2%8AxC%C2%87u%C2%84C%C2%8E%C2%8E%C2%8D%C2%82%C2%89%7Ds%C2%8E%C2%8D%C2%82s%C2%88%C2%86u%C2%8Ay%C2%80s%C2%83HCDDDEC77nnmbWsmbhfUjY%60sXV777777nnmbi%5DsnmbshfUjY%60scH77DDDE77nnmbi%5DsnmbshfUjY%60scH/flp.html?sap-ui-xx-viewCache=false&sap-ui-language=EN&sap-client=100#app-preview",
        "filters": [],
        "tables": [],
        "columns": [],
        "extractedAt": "2025-10-03T15:11:11.526Z"
};

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
                throw new Error(`Unknown tool: ${name}`);
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
                                       `column_${cellIndex}`;
                    
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
                    const text = (textEl?.textContent || '').replace(/ /g, ' ').trim();
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
                const text = (boxText?.textContent || '').replace(/ /g, ' ').trim();
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
            throw new Error(`Row index ${rowIndex} out of range`);
        }
        
        await rows[rowIndex].click();
        
        return {
            content: [
                {
                    type: 'text',
                    text: `Row ${rowIndex} selected`
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
                                    text: `Object page opened for row ${rowIndex}`
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
                    if (btn.id && /__buttond+-internalBtn/.test(btn.id)) return;
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
                            debug.push(`Strategy ${index + 1}: Found "${field.label}" = "${field.value}"`);
                        }
                    });
                } catch (error) {
                    debug.push(`Strategy ${index + 1} failed: ${error.message}`);
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
                debug: debug.join('\n')
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
            throw new Error(`Object action not found: ${action}`);
        }
        
        await this.page.click(act.selector);
        
        return {
            content: [
                {
                    type: 'text',
                    text: `Object action ${action} executed successfully`
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
            const availableFields = fields.map(f => `${f.label} (${f.fieldName})`).join(', ');
            throw new Error(`Field not found: ${fieldName}. Available fields: ${availableFields}`);
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
            throw new Error(`No selector found for field: ${fieldName}`);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: `Field ${matchedField.label} (${matchedField.fieldName}) filled with: ${value}`
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
                    selector: input.id ? `#${CSS.escape(input.id)}` : '',
                    label: '',
                    fieldName: ''
                };
                // Associated label
                const label = (input.getAttribute('aria-labelledby') && document.getElementById(input.getAttribute('aria-labelledby'))) ||
                              input.closest('.sapUiFormCLElement')?.querySelector('label, .sapMLabel') ||
                              document.querySelector(`label[for="${input.id}"]`);
                if (label) {
                    field.label = (label.textContent || '').trim().replace(/[:：]$/, '');
                }
                // Field name guess
                if (field.id) {
                    const idParts = field.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || field.id;
                    field.fieldName = (field.label || lastPart).toLowerCase().replace(/[-_s]/g, '');
                } else {
                    field.fieldName = (field.label || '').toLowerCase().replace(/[-_s]/g, '');
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
                    selector: input.id ? `#${CSS.escape(input.id)}` : '',
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
                    field.fieldName = field.label.toLowerCase().replace(/\s+/g, '');
                }
                
                // Generate a field name from ID if no label found
                if (!field.fieldName && input.id) {
                    const idParts = input.id.split('::');
                    const lastPart = idParts[idParts.length - 1] || input.id;
                    field.fieldName = lastPart.toLowerCase().replace(/[-_s]/g, '');
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
        const normalize = (str) => (str || '').toLowerCase().replace(/[-_s]/g, '');
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
                        text: `Filter not found: ${propertyKey}\n\nAvailable filters:\n${availableFilters.map(f => `- ${f.propertyKey} (${f.label})`).join('\n')}\n\nPlease use one of the property keys above.`
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
            await this.page.click(`.sapMPopupCont li:has-text("${value}")`);
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
                    text: `Filter ${filter.label} (${filter.propertyKey}) set to ${value}`
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
                            const text = (textEl?.textContent || '').replace(/ /g, ' ').trim();
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
    }

    async start(port = 3000) {
        this.app.listen(port, '0.0.0.0', () => {
            console.log(`Fiori MCP HTTP Server running on port ${port}`);
            console.log(`MCP endpoint: http://localhost:${port}/mcp`);
            console.log(`Health check: http://localhost:${port}/health`);
            console.log(`API info: http://localhost:${port}/api/info`);
            console.log(`Available tools: http://localhost:${port}/api/tools`);
        });
    }
}

// Start the server
const server = new FioriAppHTTPServer();
const port = process.env.PORT || 3000;
server.start(port);
