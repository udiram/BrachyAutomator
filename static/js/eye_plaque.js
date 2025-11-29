document.addEventListener('DOMContentLoaded', function() {
    const btnNewTask = document.getElementById('btn-new-task');
    const btnResetTask = document.getElementById('btn-reset-task');
    const btnViewHistory = document.getElementById('btn-view-history');
    const btnFinishTask = document.getElementById('btn-finish-task');
    const taskContainer = document.getElementById('task-container');
    const taskIdDisplay = document.getElementById('task-id-display');
    const taskStartTime = document.getElementById('task-start-time');
    const taskMrnInput = document.getElementById('task-mrn');
    const readOnlyBanner = document.getElementById('read-only-banner');
    const sidebar = document.getElementById('task-history-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const taskList = document.getElementById('task-list');
    const taskSearch = document.getElementById('task-search');
    
    const btnCalculate = document.getElementById('btn-calculate');
    const btnCheckRad = document.getElementById('btn-check-rad');
    
    // Initialize or load state
    let currentTask = JSON.parse(sessionStorage.getItem('brachy_current_task')) || null;
    let isReadOnly = false;

    if (currentTask) {
        restoreTask(currentTask);
    }

    // Task History Sidebar
    btnViewHistory?.addEventListener('click', function() {
        openSidebar();
        loadTaskHistory();
    });

    btnCloseSidebar?.addEventListener('click', function() {
        closeSidebar();
    });

    sidebarOverlay?.addEventListener('click', function() {
        closeSidebar();
    });

    taskSearch?.addEventListener('input', function() {
        filterTaskList(this.value);
    });

    // New Task
    btnNewTask?.addEventListener('click', function() {
        if (currentTask && !confirm('Discard current task?')) return;
        startNewTask();
    });

    // Reset Task
    btnResetTask?.addEventListener('click', function() {
        if (confirm('Reset all progress?')) {
            sessionStorage.removeItem('brachy_current_task');
            location.reload();
        }
    });

    // Finish Task
    btnFinishTask?.addEventListener('click', function() {
        finishTask();
    });

    // MRN Input
    taskMrnInput?.addEventListener('input', function() {
        if (currentTask && !isReadOnly) {
            currentTask.mrn = this.value;
            saveTask();
        }
    });

    // Calculate Activity
    btnCalculate?.addEventListener('click', calculateActivity);
    btnCheckRad?.addEventListener('click', checkRadiation);

    // Checklist toggle handler
    document.querySelectorAll('.form-check-input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (!currentTask || isReadOnly) return;
            currentTask.checks[this.id] = this.checked;
            saveTask();
            updateProgressStyles(this);
        });
    });

    function openSidebar() {
        sidebar?.classList.remove('hidden');
        sidebarOverlay?.classList.remove('hidden');
    }

    function closeSidebar() {
        sidebar?.classList.add('hidden');
        sidebarOverlay?.classList.add('hidden');
    }

    function loadTaskHistory() {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        fetch('/api/tasks', {
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderTaskList(data.tasks || []);
            } else {
                taskList.innerHTML = '<div class="loading-spinner">Error loading tasks</div>';
            }
        })
        .catch(err => {
            console.error(err);
            taskList.innerHTML = '<div class="loading-spinner">Error loading tasks</div>';
        });
    }

    function renderTaskList(tasks) {
        if (tasks.length === 0) {
            taskList.innerHTML = '<div class="loading-spinner">No tasks found</div>';
            return;
        }

        // Sort by start time (newest first)
        tasks.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

        taskList.innerHTML = tasks.map(task => `
            <div class="task-item" data-task-id="${task.id}">
                <div class="task-item-header">
                    <span class="task-item-id">${task.id}</span>
                    <span class="task-item-meta">${new Date(task.startTime).toLocaleDateString()}</span>
                </div>
                <div class="task-item-meta">
                    ${task.mrn ? `MRN: ${task.mrn} | ` : ''}User: ${task.user || 'Unknown'}
                </div>
                ${task.calculations ? `<div class="task-item-meta">Activity: ${task.calculations.containedMci?.toFixed(2) || 'N/A'} mCi</div>` : ''}
                <div class="task-item-actions">
                    <button class="btn btn-sm btn-secondary" onclick="viewTask('${task.id}')">View</button>
                    <button class="btn btn-sm btn-secondary" onclick="downloadTaskPDF('${task.id}')">PDF</button>
                    ${task.user === current_user_id ? `<button class="btn btn-sm" style="background: var(--danger-color);" onclick="deleteTask('${task.id}')">Delete</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    function filterTaskList(query) {
        const items = document.querySelectorAll('.task-item');
        const lowerQuery = query.toLowerCase();
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(lowerQuery) ? 'block' : 'none';
        });
    }

    // Get current user ID from global variable set in template
    let current_user_id = 'Unknown';
    if (typeof window.current_user_id !== 'undefined') {
        current_user_id = window.current_user_id;
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    window.viewTask = function(taskId) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        fetch(`/api/tasks/${taskId}`, {
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeSidebar();
                isReadOnly = true;
                currentTask = data.task;
                restoreTask(data.task);
                setReadOnlyMode(true);
            } else {
                alert('Error loading task: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error(err);
            alert('Error loading task');
        });
    };

    window.downloadTaskPDF = function(taskId) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        fetch(`/api/tasks/${taskId}`, {
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                exportPDF(data.task);
            } else {
                alert('Error loading task');
            }
        })
        .catch(err => {
            console.error(err);
            alert('Error loading task');
        });
    };

    window.deleteTask = function(taskId) {
        if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
        
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadTaskHistory();
            } else {
                alert('Error deleting task: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error(err);
            alert('Error deleting task');
        });
    };

    function startNewTask() {
        const id = 'TASK-' + Date.now().toString().slice(-6);
        const now = new Date().toISOString();
        currentTask = {
            id: id,
            mrn: '',
            startTime: now,
            checks: {},
            calculations: null,
            radReading: null,
            notes: {},
            uploads: {}
        };
        isReadOnly = false;
        saveTask();
        restoreTask(currentTask);
        setReadOnlyMode(false);
    }

    function saveTask() {
        sessionStorage.setItem('brachy_current_task', JSON.stringify(currentTask));
    }

    function setReadOnlyMode(readOnly) {
        isReadOnly = readOnly;
        
        if (readOnly) {
            readOnlyBanner?.classList.remove('hidden');
            btnFinishTask?.classList.add('hidden');
            btnResetTask?.classList.add('hidden');
            
            // Disable all inputs
            document.querySelectorAll('input, textarea, button:not(#btn-export-pdf):not(#btn-export-csv)').forEach(el => {
                if (el.id !== 'btn-export-pdf' && el.id !== 'btn-export-csv' && !el.classList.contains('btn-details')) {
                    el.disabled = true;
                }
            });
            
            // Re-enable export buttons
            document.getElementById('btn-export-pdf')?.removeAttribute('disabled');
            document.getElementById('btn-export-csv')?.removeAttribute('disabled');
        } else {
            readOnlyBanner?.classList.add('hidden');
            btnFinishTask?.classList.remove('hidden');
            btnResetTask?.classList.remove('hidden');
            
            // Enable all inputs
            document.querySelectorAll('input, textarea, button').forEach(el => {
                el.disabled = false;
            });
        }
    }

    function restoreTask(task) {
        taskIdDisplay.textContent = task.id;
        taskStartTime.textContent = new Date(task.startTime).toLocaleString();
        if (taskMrnInput) taskMrnInput.value = task.mrn || '';
        taskContainer.classList.remove('hidden');
        btnNewTask.classList.add('hidden');
        if (!isReadOnly) btnResetTask.classList.remove('hidden');

        // Restore checks
        for (const [id, checked] of Object.entries(task.checks || {})) {
            const el = document.getElementById(id);
            if (el) {
                el.checked = checked;
                updateProgressStyles(el);
            }
        }

        // Restore calculations if any
        if (task.calculations) {
            if (task.calculations.assaySeeds !== undefined) {
                const assaySeedsEl = document.getElementById('calc-assay-seeds');
                const assayActivityEl = document.getElementById('calc-assay-activity');
                const plaqueSeedsEl = document.getElementById('calc-plaque-seeds');
                const plaqueActivityEl = document.getElementById('calc-plaque-activity');
                
                if (assaySeedsEl) assaySeedsEl.value = task.calculations.assaySeeds;
                if (assayActivityEl) assayActivityEl.value = task.calculations.assayApparent;
                if (plaqueSeedsEl) plaqueSeedsEl.value = task.calculations.plaqueSeeds;
                if (plaqueActivityEl) plaqueActivityEl.value = task.calculations.plaqueApparent;
            } else {
                // Old format fallback
                const assaySeedsEl = document.getElementById('calc-assay-seeds');
                const assayActivityEl = document.getElementById('calc-assay-activity');
                if (assaySeedsEl) assaySeedsEl.value = task.calculations.seeds || 0;
                if (assayActivityEl) assayActivityEl.value = task.calculations.apparent || 0;
            }
            
            displayCalculationResults(task.calculations);
        }
        
        if (task.radReading) {
            const radInput = document.getElementById('rad-reading');
            if (radInput) {
                radInput.value = task.radReading;
                checkRadiation();
            }
        }

        // Restore notes
        for (const [id, note] of Object.entries(task.notes || {})) {
            const noteEl = document.querySelector(`.step-note[data-id="${id}"]`);
            if (noteEl) noteEl.value = note;
        }

        // Restore uploads and show previews
        for (const [stepId, files] of Object.entries(task.uploads || {})) {
            const previewContainer = document.getElementById(`${stepId}-preview`);
            if (previewContainer && files.length > 0) {
                previewContainer.innerHTML = files.map(file => `
                    <div class="file-preview" onclick="expandImage('${file.path}', '${file.filename}')">
                        <img src="${file.path}" alt="${file.filename}" onerror="this.style.display='none'">
                        <div class="file-name">${file.filename}</div>
                    </div>
                `).join('');
            }
        }
    }

    function updateProgressStyles(checkbox) {
        const label = checkbox.nextElementSibling;
        if (checkbox.checked) {
            label.classList.add('step-completed');
        } else {
            label.classList.remove('step-completed');
        }
    }

    function calculateActivity() {
        if (isReadOnly) return;
        
        const assaySeeds = parseFloat(document.getElementById('calc-assay-seeds')?.value) || 0;
        const assayApparent = parseFloat(document.getElementById('calc-assay-activity')?.value) || 0;
        const plaqueSeeds = parseFloat(document.getElementById('calc-plaque-seeds')?.value) || 0;
        const plaqueApparent = parseFloat(document.getElementById('calc-plaque-activity')?.value) || 0;

        const assayTotal = assaySeeds * assayApparent * 1.62;
        const plaqueTotal = plaqueSeeds * plaqueApparent * 1.62;
        const containedMci = assayTotal + plaqueTotal;
        const containedGbq = containedMci / 27.027;

        const results = {
            assaySeeds: assaySeeds,
            assayApparent: assayApparent,
            plaqueSeeds: plaqueSeeds,
            plaqueApparent: plaqueApparent,
            containedMci: containedMci,
            containedGbq: containedGbq
        };

        if (!currentTask) startNewTask();
        currentTask.calculations = results;
        saveTask();
        displayCalculationResults(results);
    }

    function displayCalculationResults(results) {
        const resMci = document.getElementById('res-mci');
        const resGbq = document.getElementById('res-gbq');
        const gbqRow = document.getElementById('res-gbq-row');
        const calcResults = document.getElementById('calc-results');
        
        if (resMci) resMci.textContent = results.containedMci.toFixed(2);
        
        if (results.containedMci > 81) {
            if (resGbq) resGbq.textContent = results.containedGbq.toFixed(2);
            if (gbqRow) gbqRow.classList.remove('hidden');
        } else {
            if (gbqRow) gbqRow.classList.add('hidden');
        }

        if (calcResults) calcResults.classList.remove('hidden');

        const mci = results.containedMci;
        const workflowSection = document.getElementById('workflow-section');
        const flowLess10 = document.getElementById('flow-less-10');
        const flow10to81 = document.getElementById('flow-10-81');
        const flowMore81 = document.getElementById('flow-more-81');
        const catBox = document.getElementById('calc-category');

        if (workflowSection) workflowSection.classList.remove('hidden');
        if (flowLess10) flowLess10.classList.add('hidden');
        if (flow10to81) flow10to81.classList.add('hidden');
        if (flowMore81) flowMore81.classList.add('hidden');

        if (mci < 10) {
            if (flowLess10) flowLess10.classList.remove('hidden');
            if (catBox) {
            catBox.textContent = "Category: < 10 mCi. Follow '< 10 mCi' Protocol.";
                catBox.className = 'warning-box info-blue';
            }
        } else if (mci <= 81) {
            if (flow10to81) flow10to81.classList.remove('hidden');
            if (catBox) {
            catBox.textContent = "Category: 10-81 mCi. Follow '10-81 mCi' Protocol.";
                catBox.className = 'warning-box warning-orange';
            }
        } else {
            if (flowMore81) flowMore81.classList.remove('hidden');
            if (catBox) {
            catBox.textContent = "Category: > 81 mCi. Follow '> 81 mCi' Protocol.";
                catBox.className = 'warning-box danger-red';
            }
        }
    }

    function checkRadiation() {
        const reading = parseFloat(document.getElementById('rad-reading')?.value);
        if (isNaN(reading)) {
            alert('Enter a valid reading.');
            return;
        }
        
        const resBox = document.getElementById('rad-result');
        const classSpan = document.getElementById('rad-class');
        const descSpan = document.getElementById('rad-desc');
        
        if (resBox) resBox.classList.remove('hidden');
        if (currentTask) {
        currentTask.radReading = reading;
        saveTask();
        }

        if (reading <= 0.5) {
            if (classSpan) {
            classSpan.textContent = "Radioactive White-I";
            classSpan.style.color = "green";
            }
            if (descSpan) descSpan.textContent = "Safe for standard handling. No TI required.";
        } else if (reading <= 50) {
            if (classSpan) {
            classSpan.textContent = "Radioactive Yellow-II";
            classSpan.style.color = "orange";
            }
            if (descSpan) descSpan.textContent = "Requires Yellow-II label. Max TI = 1.";
        } else if (reading <= 200) {
            if (classSpan) {
            classSpan.textContent = "Radioactive Yellow-III";
            classSpan.style.color = "red";
            }
            if (descSpan) descSpan.textContent = "Requires Yellow-III label. Max TI = 10.";
        } else {
            if (classSpan) {
            classSpan.textContent = "DANGER - EXCEEDS LIMITS";
            classSpan.style.color = "darkred";
            }
            if (descSpan) descSpan.textContent = "Contact RSO immediately. Do not ship.";
        }
    }

    // Image expander
    window.expandImage = function(imagePath, filename) {
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-image');
        const modalCaption = document.getElementById('modal-caption');
        
        if (modal && modalImg) {
            modalImg.src = imagePath;
            if (modalCaption) modalCaption.textContent = filename;
            modal.classList.add('active');
        }
    };

    // Close image modal
    const imageModalClose = document.querySelector('.image-modal-close');
    if (imageModalClose) {
        imageModalClose.addEventListener('click', function() {
            document.getElementById('image-modal')?.classList.remove('active');
        });
    }

    const imageModal = document.getElementById('image-modal');
    if (imageModal) {
        imageModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    }

    // Close finish modal when clicking overlay
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function() {
            document.getElementById('finish-modal')?.classList.add('hidden');
            this.classList.add('hidden');
        });
    }

    function getIncompleteTasks() {
        const incomplete = [];
        
        // Get all checkboxes
        document.querySelectorAll('.form-check-input').forEach(checkbox => {
            if (!checkbox.checked) {
                const label = checkbox.nextElementSibling;
                if (label) {
                    incomplete.push(label.textContent.trim());
                }
            }
        });
        
        return incomplete;
    }

    function finishTask() {
        if (!currentTask) {
            alert('No task to finish.');
            return;
        }

        if (isReadOnly) {
            alert('Cannot finish a read-only task.');
            return;
        }

        const incomplete = getIncompleteTasks();
        const finishModal = document.getElementById('finish-modal');
        const modalOverlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('finish-modal-title');
        const modalBody = document.getElementById('finish-modal-body');
        const modalCancel = document.getElementById('finish-modal-cancel');
        const modalConfirm = document.getElementById('finish-modal-confirm');

        if (!finishModal || !modalBody) return;

        // Clear previous handlers
        const newConfirm = modalConfirm.cloneNode(true);
        modalConfirm.parentNode.replaceChild(newConfirm, modalConfirm);

        if (incomplete.length > 0) {
            // Show incomplete tasks list
            modalTitle.textContent = 'Incomplete Tasks';
            modalBody.innerHTML = `
                <p><strong>The following ${incomplete.length} task${incomplete.length > 1 ? 's are' : ' is'} not yet completed:</strong></p>
                <div class="incomplete-tasks-list">
                    <ul>
                        ${incomplete.map(task => `<li>${escapeHtml(task)}</li>`).join('')}
                    </ul>
                </div>
                <p style="margin-top: 1rem;">Please complete all tasks before finishing, or enter your password to override:</p>
                <div class="password-override">
                    <label for="finish-password">Password:</label>
                    <input type="password" id="finish-password" class="form-control" placeholder="Enter password to override" autocomplete="off">
                </div>
            `;

            newConfirm.textContent = 'Finish Anyway';
            newConfirm.onclick = function() {
                const password = document.getElementById('finish-password')?.value;
                if (!password) {
                    alert('Please enter your password to override.');
                    return;
                }
                // Verify password
                verifyPasswordAndFinish(password);
            };
        } else {
            // All tasks complete - show confirmation
            modalTitle.textContent = 'Confirm Completion';
            modalBody.innerHTML = `
                <p style="color: var(--warning-color); font-weight: bold;">⚠️ Are you sure you're done?</p>
                <p>Please double-check all steps before submitting. This action cannot be undone.</p>
            `;

            newConfirm.textContent = 'Yes, Finish Task';
            newConfirm.onclick = function() {
                actuallyFinishTask();
            };
        }

        modalCancel.onclick = function() {
            finishModal.classList.add('hidden');
            modalOverlay.classList.add('hidden');
        };

        finishModal.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
    }

    function verifyPasswordAndFinish(password) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        // Verify password with backend
        fetch('/api/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ password: password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                actuallyFinishTask();
            } else {
                alert('Invalid password. Cannot override without correct password.');
            }
        })
        .catch(err => {
            console.error(err);
            alert('Error verifying password');
        });
    }

    function actuallyFinishTask() {
        const finishModal = document.getElementById('finish-modal');
        const modalOverlay = document.getElementById('modal-overlay');
        
        finishModal.classList.add('hidden');
        modalOverlay.classList.add('hidden');

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        // Add end time
        currentTask.endTime = new Date().toISOString();
        currentTask.user = current_user_id || 'Unknown';

        fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(currentTask)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Task saved successfully!');
                sessionStorage.removeItem('brachy_current_task');
                location.reload();
            } else {
                alert('Error saving task: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error(err);
            alert('Error saving task');
        });
    }

    // Details toggle
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('btn-details')) {
            const targetId = e.target.getAttribute('data-target');
            const target = document.getElementById(targetId);
            if (target) target.classList.toggle('hidden');
        }
    });

    // Notes input
    document.addEventListener('input', function(e) {
        if (e.target && e.target.classList.contains('step-note')) {
            if (!currentTask || isReadOnly) return;
            const id = e.target.getAttribute('data-id');
            if (!currentTask.notes) currentTask.notes = {};
            currentTask.notes[id] = e.target.value;
            saveTask();
        }
    });

    // File upload with preview
    document.addEventListener('change', function(e) {
        if (e.target && e.target.classList.contains('step-file')) {
            if (!currentTask || isReadOnly) return;
            const input = e.target;
            const id = input.getAttribute('data-id');
            const file = input.files[0];
            if (!file) return;

            // Validate image file
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file.');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('task_id', currentTask.id);
            formData.append('step_id', id);
            
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const previewContainer = document.getElementById(`${id}-preview`);

            // Show loading
            if (previewContainer) {
                previewContainer.innerHTML = '<div class="loading-spinner">Uploading...</div>';
            }

            fetch('/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (!currentTask.uploads) currentTask.uploads = {};
                    if (!currentTask.uploads[id]) currentTask.uploads[id] = [];
                    currentTask.uploads[id].push({
                        filename: data.filename,
                        path: data.path,
                        uploadedAt: new Date().toISOString()
                    });
                    saveTask();
                    
                    // Show preview with click to expand
                    if (previewContainer) {
                        const existingPreviews = currentTask.uploads[id].map((file, idx) => `
                            <div class="file-preview" onclick="expandImage('${file.path}', '${file.filename}')">
                                <img src="${file.path}" alt="${file.filename}" onerror="this.style.display='none'">
                                <div class="file-name">${file.filename}</div>
                            </div>
                        `).join('');
                        previewContainer.innerHTML = existingPreviews;
                    }
                } else {
                    alert('Upload failed: ' + data.message);
                    if (previewContainer) previewContainer.innerHTML = '';
                }
            })
            .catch(err => {
                console.error(err);
                alert('Upload error');
                if (previewContainer) previewContainer.innerHTML = '';
            });
        }
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', function() {
        if (!currentTask || !currentTask.calculations) {
            alert('No calculation data to export.');
            return;
        }
        const rows = [
            ['Task ID', 'MRN', 'Date', 'Assay Seeds', 'Assay mCi', 'Plaque Seeds', 'Plaque mCi', 'Total Contained mCi', 'Total Contained GBq', 'mrem/hr'],
            [
                currentTask.id,
                currentTask.mrn || '',
                currentTask.startTime,
                currentTask.calculations.assaySeeds || 0,
                currentTask.calculations.assayApparent || 0,
                currentTask.calculations.plaqueSeeds || 0,
                currentTask.calculations.plaqueApparent || 0,
                currentTask.calculations.containedMci.toFixed(2),
                currentTask.calculations.containedGbq.toFixed(2),
                currentTask.radReading || ''
            ]
        ];
        let csvContent = "data:text/csv;charset=utf-8," 
            + rows.map(e => e.join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "brachy_calc_" + currentTask.id + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Export PDF
    function exportPDF(task) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        
        fetch('/export-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(task)
        })
        .then(response => {
            if (response.ok) {
                return response.blob();
            }
            throw new Error('Export failed');
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'brachy_report_' + task.id + '.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => alert('Error exporting PDF: ' + error.message));
    }

    document.getElementById('btn-export-pdf')?.addEventListener('click', function() {
        if (!currentTask) {
            alert('No task to export.');
            return;
        }
        exportPDF(currentTask);
    });
});
