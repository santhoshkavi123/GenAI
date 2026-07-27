document.addEventListener("DOMContentLoaded", () => {
    // State Variables
    let patients = [];
    let selectedPatient = null;
    let simulationData = null;
    let activeStep = 0; // 0: Idle, 1: Front Desk, 2: Consultation, 3: Exam, 4: Dx & Routing, 5: Radiologist, 6: End
    let isRunning = false;
    let stepTimeout = null;

    // DOM Elements
    const patientListContainer = document.getElementById("patient-list-container");
    const patientSearchInput = document.getElementById("patient-search");
    const btnRun = document.getElementById("btn-run");
    const btnStep = document.getElementById("btn-step");
    const btnReset = document.getElementById("btn-reset");
    const btnClearConsole = document.getElementById("btn-clear-console");
    const toggleMismatch = document.getElementById("toggle-mismatch");
    const currentNodeBadge = document.getElementById("current-node-badge");
    const consoleOutput = document.getElementById("console-output");

    // Face / Radiologist Scanners
    const cardFD = document.getElementById("card-front-desk");
    const faceIdImg = document.getElementById("face-id-img");
    const fdValGender = document.getElementById("fd-val-gender");
    const fdValAge = document.getElementById("fd-val-age");
    const fdNarrative = document.getElementById("fd-narrative");
    const badgeFD = document.getElementById("badge-fd");

    const cardPhys = document.getElementById("card-physician");
    const chatBox = document.getElementById("physician-chat-box");
    const vitalFever = document.getElementById("vital-val-fever");
    const vitalBP = document.getElementById("vital-val-bp");
    const vitalChol = document.getElementById("vital-val-chol");
    const physDxRoute = document.getElementById("phys-dx-route");
    const badgePhys = document.getElementById("badge-phys");

    const cardRad = document.getElementById("card-radiologist");
    const xrayImg = document.getElementById("xray-img");
    const xrayScanner = cardRad.querySelector(".xray-scanner");
    const radValClass = document.getElementById("rad-val-class");
    const radNarrative = document.getElementById("rad-narrative");
    const badgeRad = document.getElementById("badge-rad");

    // Initialize application
    init();

    async function init() {
        bindEvents();
        await fetchPatients();
        setupPlaceholders();
    }

    function bindEvents() {
        patientSearchInput.addEventListener("input", filterPatients);
        btnRun.addEventListener("click", runFullSimulation);
        btnStep.addEventListener("click", stepSimulation);
        btnReset.addEventListener("click", resetSimulation);
        btnClearConsole.addEventListener("click", () => {
            consoleOutput.innerHTML = "";
        });
        toggleMismatch.addEventListener("change", () => {
            logConsole("SYSTEM", `Toggled Mismatched Identity: ${toggleMismatch.checked ? "ENABLED" : "DISABLED"}`);
            if (selectedPatient) {
                resetSimulationStateOnly();
            }
        });
    }

    // Set up placeholder avatars/X-rays as inline SVGs/data URLs to avoid loading issues
    function setupPlaceholders() {
        // Simple avatar fallback
        faceIdImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%231e293b'><circle cx='50' cy='35' r='20' fill='%23475569'/><path d='M20 80c0-15 12-25 30-25s30 10 30 25z' fill='%23475569'/><rect width='100' height='100' fill='none' stroke='%2306b6d4' stroke-width='2'/></svg>";
        xrayImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%230f172a'><rect width='100' height='100' fill='%23020617'/><path d='M35 15c0 0-5 25-5 35s5 35 5 35M65 15c0 0 5 25 5 35s-5 35-5 35M20 40h60M20 60h60' stroke='%23334155' stroke-width='3' fill='none'/><rect width='100' height='100' fill='none' stroke='%23475569' stroke-width='1'/></svg>";
    }

    async function fetchPatients() {
        try {
            const res = await fetch("/api/patients");
            if (!res.ok) throw new Error("Server returned non-ok status");
            patients = await res.json();
            logConsole("SYSTEM", "Connected to FastAPI backend database successfully.");
            renderPatientList(patients);
            if (patients.length > 0) {
                selectPatient(patients[0].id);
            }
        } catch (err) {
            logConsole("SYSTEM", "FastAPI backend database unavailable. Falling back to client-side static patients.json data source.");
            try {
                const res = await fetch("patients.json");
                if (!res.ok) throw new Error("Static json load failed");
                const rawPatients = await res.json();
                patients = rawPatients.map(p => ({
                    id: p.Patient_ID,
                    first_name: p.First_Name,
                    last_name: p.Last_Name,
                    full_name: `${p.First_Name} ${p.Last_Name}`.trim(),
                    age: parseInt(p.Age),
                    gender: p.Gender,
                    disease: p.Disease,
                    _raw: p
                }));
                renderPatientList(patients);
                if (patients.length > 0) {
                    selectPatient(patients[0].id);
                }
            } catch (staticErr) {
                logConsole("ERROR", "Failed to fetch patient data from both server and static patients.json.");
                patientListContainer.innerHTML = "<div class='error-msg'>Failed to load database. Ensure patients.json is available.</div>";
            }
        }
    }

    function renderPatientList(items) {
        patientListContainer.innerHTML = "";
        if (items.length === 0) {
            patientListContainer.innerHTML = "<div class='empty-msg'>No patients found.</div>";
            return;
        }

        items.forEach(p => {
            const item = document.createElement("div");
            item.className = "patient-item";
            item.dataset.id = p.id;
            item.innerHTML = `
                <div class="patient-item-header">
                    <span class="patient-name">${p.full_name}</span>
                    <span class="patient-id-badge">${p.id}</span>
                </div>
                <div class="patient-meta">
                    <span>${p.gender} • ${p.age} yrs</span>
                    <span class="disease-lbl">${p.disease}</span>
                </div>
            `;
            item.addEventListener("click", () => selectPatient(p.id));
            patientListContainer.appendChild(item);
        });
    }

    function filterPatients() {
        const query = patientSearchInput.value.toLowerCase();
        const filtered = patients.filter(p => 
            p.full_name.toLowerCase().includes(query) || 
            p.id.toLowerCase().includes(query) ||
            p.disease.toLowerCase().includes(query)
        );
        renderPatientList(filtered);
    }

    async function selectPatient(id) {
        if (isRunning) return;

        // Update list selection UI
        document.querySelectorAll(".patient-item").forEach(item => {
            item.classList.remove("selected");
        });
        const selectedEl = document.querySelector(`.patient-item[data-id="${id}"]`);
        if (selectedEl) selectedEl.classList.add("selected");

        selectedPatient = patients.find(p => p.id === id);
        logConsole("SYSTEM", `Loaded patient profile: ${selectedPatient.full_name} (${selectedPatient.id})`);
        
        resetSimulationStateOnly();
    }

    function resetSimulationStateOnly() {
        if (stepTimeout) clearTimeout(stepTimeout);
        isRunning = false;
        activeStep = 0;
        simulationData = null;
        
        // Reset controls
        btnRun.disabled = false;
        btnStep.disabled = false;
        btnRun.innerHTML = `<i class="bx bx-play-circle"></i> Run Workflow`;

        // Clear Agent visual elements
        badgeFD.className = "agent-badge badge-neutral";
        badgeFD.textContent = "Inactive";
        fdValGender.textContent = "--";
        fdValAge.textContent = "--";
        fdNarrative.innerHTML = "<em>Waiting for verification to start...</em>";
        cardFD.querySelector(".scanner-container").classList.remove("scanner-active");

        badgePhys.className = "agent-badge badge-neutral";
        badgePhys.textContent = "Inactive";
        chatBox.innerHTML = `<div class="chat-placeholder">No consultation session active</div>`;
        vitalFever.textContent = "--";
        vitalBP.textContent = "--";
        vitalChol.textContent = "--";
        physDxRoute.textContent = "--";
        physDxRoute.className = "dx-value";

        badgeRad.className = "agent-badge badge-neutral";
        badgeRad.textContent = "Inactive";
        radValClass.textContent = "--";
        radNarrative.innerHTML = "<em>Radiological scans will load conditionally if ordered by the physician.</em>";
        xrayScanner.classList.remove("scanner-active", "scanned-pneumonia");

        // Reset State Graph on SVG
        document.querySelectorAll(".graph-node").forEach(node => {
            node.classList.remove("active", "success", "failed");
        });
        document.querySelectorAll("line, path").forEach(edge => {
            edge.className.baseVal = "";
        });

        // Glow Start Node initially
        document.getElementById("node-START").classList.add("success");
        currentNodeBadge.textContent = "State: IDLE";
        currentNodeBadge.className = "node-badge";
    }

    function resetSimulation() {
        resetSimulationStateOnly();
        logConsole("SYSTEM", "Workflow reset. Ready to run.");
    }

    async function runFullSimulation() {
        if (isRunning && btnRun.textContent.includes("Pause")) {
            // Pause simulation
            isRunning = false;
            btnRun.innerHTML = `<i class="bx bx-play-circle"></i> Resume`;
            logConsole("SYSTEM", "Simulation paused.");
            return;
        }

        isRunning = true;
        btnRun.innerHTML = `<i class="bx bx-pause-circle"></i> Pause`;
        
        if (activeStep === 0) {
            await fetchSimulationData();
        }

        autoPlayNextStep();
    }

    function autoPlayNextStep() {
        if (!isRunning) return;
        
        if (activeStep < 6) {
            stepSimulation();
            let delay = 3500; // default delay for animations
            if (activeStep === 2) delay = 5000; // Consultation chat typing takes longer
            if (activeStep === 5) delay = 4000; // Radiologist scanner takes longer
            
            stepTimeout = setTimeout(autoPlayNextStep, delay);
        } else {
            isRunning = false;
            btnRun.disabled = true;
            btnStep.disabled = true;
            btnRun.innerHTML = `<i class="bx bx-check-circle"></i> Completed`;
        }
    }

    async function fetchSimulationData() {
        try {
            const res = await fetch("/api/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    force_verify_fail: toggleMismatch.checked
                })
            });
            if (!res.ok) throw new Error("Server simulation response not ok");
            simulationData = await res.json();
            logConsole("SYSTEM", "Graph compiled via FastAPI backend. Executing multi-agent pipeline...");
        } catch (err) {
            logConsole("SYSTEM", "FastAPI backend simulation unavailable. Running client-side simulation engine...");
            simulationData = runClientSideSimulation(selectedPatient, toggleMismatch.checked);
            if (!simulationData) {
                logConsole("ERROR", "Failed to compile/execute graph simulation locally.");
                isRunning = false;
                btnRun.innerHTML = `<i class="bx bx-play-circle"></i> Run Workflow`;
            } else {
                logConsole("SYSTEM", "Local client-side simulation compiled successfully. Executing multi-agent pipeline...");
            }
        }
    }

    async function stepSimulation() {
        if (activeStep === 0 && !simulationData) {
            btnStep.disabled = true;
            await fetchSimulationData();
            btnStep.disabled = false;
        }

        activeStep++;
        executeStep(activeStep);
    }

    function executeStep(step) {
        if (!simulationData) return;

        switch (step) {
            case 1:
                runStepFrontDesk();
                break;
            case 2:
                runStepPhysicianConsultation();
                break;
            case 3:
                runStepPhysicianExamination();
                break;
            case 4:
                runStepPhysicianDiagnosis();
                break;
            case 5:
                runStepRadiologist();
                break;
            case 6:
                runStepEnd();
                break;
            default:
                break;
        }
    }

    // ------------------ AGENT GRAPH NODES IMPLEMENTATION ------------------

    // 1. FRONT DESK ID SCANNER
    function runStepFrontDesk() {
        currentNodeBadge.textContent = "State: FRONT DESK AGENT";
        currentNodeBadge.className = "node-badge running";
        
        // Highlight active node and edges
        document.getElementById("node-START").classList.add("success");
        document.getElementById("node-front_desk_agent_node").classList.add("active");
        document.getElementById("edge-start").className.baseVal = "active-edge";

        badgeFD.className = "agent-badge badge-active";
        badgeFD.textContent = "Scanning";
        cardFD.querySelector(".scanner-container").classList.add("scanner-active");
        
        const fdData = simulationData.steps[0].outputs;
        
        logConsole("AGENT", "Front Desk Agent: Initiating Face-ID biometric scan...");
        
        // Typewriter/Reveal predicted age and gender after scanning delay
        setTimeout(() => {
            fdValGender.textContent = fdData.predicted_gender.toUpperCase();
            fdValAge.textContent = fdData.predicted_age_group;
            
            cardFD.querySelector(".scanner-container").classList.remove("scanner-active");
            
            if (fdData.verified) {
                badgeFD.className = "agent-badge badge-success";
                badgeFD.textContent = "Verified";
                fdNarrative.innerHTML = `<strong>Verification Success:</strong> Patient matching database record. Ready for consult.`;
                document.getElementById("node-front_desk_agent_node").className.baseVal = "graph-node success";
                document.getElementById("edge-start").className.baseVal = "success-edge";
                logConsole("SUCCESS", "Front Desk Agent: Biometric attributes match patient record.");
            } else {
                badgeFD.className = "agent-badge badge-failed";
                badgeFD.textContent = "Verification Failed";
                fdNarrative.innerHTML = `<strong>Verification Failed:</strong> Biometric parameters do not match database. Exit route triggered.`;
                document.getElementById("node-front_desk_agent_node").className.baseVal = "graph-node failed";
                document.getElementById("node-exit_failed").classList.add("failed");
                document.getElementById("edge-fd-fail").className.baseVal = "active-edge";
                
                logConsole("FAILED", "Front Desk Agent: Verification mismatch. Aborting workflow.");
                
                // Halt auto-simulation since it failed verification
                if (isRunning) {
                    isRunning = false;
                    btnRun.disabled = true;
                    btnStep.disabled = true;
                    btnRun.innerHTML = `<i class="bx bx-x-circle"></i> Halted (Failed Verification)`;
                }
            }
        }, 2000);
    }

    // 2. PHYSICIAN CONSULTATION CHAT
    function runStepPhysicianConsultation() {
        if (!simulationData.verified) return;

        currentNodeBadge.textContent = "State: PHYSICIAN (CONSULT)";
        currentNodeBadge.className = "node-badge running";

        document.getElementById("node-front_desk_agent_node").classList.remove("active");
        document.getElementById("node-physician_agent_node").classList.add("active");
        document.getElementById("edge-fd-phys").className.baseVal = "active-edge";

        badgePhys.className = "agent-badge badge-active";
        badgePhys.textContent = "Consulting";

        chatBox.innerHTML = "";
        logConsole("AGENT", "Physician Agent: Beginning anamnesis/symptom questionnaire...");

        const convoLines = simulationData.steps[1].outputs.conversation.split("\n");
        let idx = 0;

        function printNextChatLine() {
            if (idx < convoLines.length) {
                const line = convoLines[idx];
                const msg = document.createElement("div");
                
                if (line.startsWith("Physician:")) {
                    msg.className = "msg physician";
                    msg.textContent = line.replace("Physician:", "").strip();
                } else if (line.startsWith("Patient:")) {
                    msg.className = "msg patient";
                    msg.textContent = line.replace("Patient:", "").strip();
                } else {
                    msg.className = "msg system-summary";
                    msg.textContent = line;
                }

                chatBox.appendChild(msg);
                chatBox.scrollTop = chatBox.scrollHeight;
                
                idx++;
                setTimeout(printNextChatLine, 650);
            } else {
                // Done printing conversation, show physician summary
                const sumMsg = document.createElement("div");
                sumMsg.className = "msg system-summary";
                sumMsg.textContent = simulationData.steps[1].outputs.summary;
                chatBox.appendChild(sumMsg);
                chatBox.scrollTop = chatBox.scrollHeight;
                logConsole("AGENT", "Physician Agent: Anamnesis complete. Summary logged.");
            }
        }

        printNextChatLine();
    }

    // 3. PHYSICIAN PHYSICAL EXAMINATION
    function runStepPhysicianExamination() {
        currentNodeBadge.textContent = "State: PHYSICIAN (EXAM)";
        
        logConsole("AGENT", "Physician Agent: Performing physical check & vitals measurement...");
        
        const examData = simulationData.steps[2].outputs;

        // Animate medical vital indicators
        setTimeout(() => {
            vitalFever.textContent = examData.fever;
            vitalBP.textContent = examData.blood_pressure;
            vitalChol.textContent = examData.cholesterol_level;

            logConsole("SUCCESS", `Vitals Checked - Fever: ${examData.fever}, BP: ${examData.blood_pressure}, Cholesterol: ${examData.cholesterol_level}`);
        }, 1000);
    }

    // 4. PHYSICIAN DIAGNOSIS & ROUTING
    function runStepPhysicianDiagnosis() {
        currentNodeBadge.textContent = "State: PHYSICIAN (DIAGNOSIS)";
        
        const dxData = simulationData.steps[3].outputs;
        logConsole("AGENT", `Physician Agent: Diagnosing clinical indicators...`);

        badgePhys.className = "agent-badge badge-success";
        badgePhys.textContent = "Diagnosed";

        setTimeout(() => {
            physDxRoute.textContent = dxData.diagnosis;
            document.getElementById("node-physician_agent_node").className.baseVal = "graph-node success";
            document.getElementById("edge-fd-phys").className.baseVal = "success-edge";

            if (dxData.should_do_xray) {
                physDxRoute.className = "dx-value route-xray";
                document.getElementById("edge-phys-rad").className.baseVal = "active-edge";
                logConsole("WARNING", `Physician Agent: Severe pulmonary indicators detected. Ordering Chest X-Ray diagnostic scans.`);
            } else {
                physDxRoute.className = "dx-value route-recover";
                document.getElementById("edge-phys-end").className.baseVal = "active-edge";
                logConsole("SUCCESS", `Physician Agent: No emergency symptoms. Clinical routing: Discharge with rest prescription.`);
            }
        }, 800);
    }

    // 5. RADIOLOGIST CLASSIFIER (CONDITIONAL)
    function runStepRadiologist() {
        const dxData = simulationData.steps[3].outputs;
        
        if (!dxData.should_do_xray) {
            logConsole("SYSTEM", "Bypassing Radiologist node (conditional routing edge evaluates to FALSE).");
            stepSimulation(); // Auto-skip to End node
            return;
        }

        currentNodeBadge.textContent = "State: RADIOLOGIST DIAGNOSTIC";
        currentNodeBadge.className = "node-badge running";

        document.getElementById("node-radiologist_agent_node").classList.add("active");
        document.getElementById("edge-phys-rad").className.baseVal = "success-edge";

        badgeRad.className = "agent-badge badge-active";
        badgeRad.textContent = "Analyzing";
        xrayScanner.classList.add("scanner-active");

        logConsole("AGENT", "Radiologist Agent: Loading patient chest radiography scan...");

        const radData = simulationData.steps[4].outputs;

        setTimeout(() => {
            radValClass.textContent = radData.prediction;
            xrayScanner.classList.remove("scanner-active");

            if (radData.prediction === "PNEUMONIA") {
                xrayScanner.classList.add("scanned-pneumonia"); // Trigger red heatmap grid glow
                radNarrative.innerHTML = `<strong>Diagnostic Alert:</strong> High opacity indicators localized on lungs. ViT model classifies status as <strong>PNEUMONIA</strong>.`;
                logConsole("FAILED", "Radiologist Agent: Vision Transformer model classifies chest scan positive for Pneumonia.");
            } else {
                radNarrative.innerHTML = `<strong>Diagnostic Status:</strong> Lung fields clear. ViT model classifies status as <strong>NORMAL</strong>.`;
                logConsole("SUCCESS", "Radiologist Agent: Vision Transformer model classifies chest scan negative (Normal).");
            }

            badgeRad.className = "agent-badge badge-success";
            badgeRad.textContent = "Completed";
            document.getElementById("node-radiologist_agent_node").className.baseVal = "graph-node success";
            document.getElementById("edge-rad-end").className.baseVal = "active-edge";
        }, 2500);
    }

    // 6. END OF FLOW
    function runStepEnd() {
        currentNodeBadge.textContent = "State: COMPLETED";
        currentNodeBadge.className = "node-badge finished";

        document.getElementById("node-radiologist_agent_node").classList.remove("active");
        document.getElementById("node-END").classList.add("success");
        
        // Finalize edges
        const dxData = simulationData.steps[3].outputs;
        if (dxData.should_do_xray) {
            document.getElementById("edge-rad-end").className.baseVal = "success-edge";
        } else {
            document.getElementById("edge-phys-end").className.baseVal = "success-edge";
        }

        logConsole("SYSTEM", "Workflow execution completed successfully. Agent state resolved to terminal state.");
        
        if (isRunning) {
            isRunning = false;
            btnRun.disabled = true;
            btnStep.disabled = true;
            btnRun.innerHTML = `<i class="bx bx-check-circle"></i> Completed`;
        }
    }

    // ------------------ LOGGING HELPER ------------------
    function logConsole(source, text) {
        const line = document.createElement("div");
        line.className = `console-line ${source.toLowerCase()}`;
        line.textContent = `[${source}] ${text}`;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    // ------------------ CLIENT-SIDE SIMULATION ENGINE ------------------
    function runClientSideSimulation(patientRecord, forceVerifyFail) {
        let patient = patientRecord._raw || patientRecord;
        if (!patient || !patient.Patient_ID) {
            const found = patients.find(p => p.id === patientRecord.id);
            if (found && found._raw) {
                patient = found._raw;
            } else {
                patient = {
                    Patient_ID: patientRecord.id || "PAT1000000007",
                    First_Name: patientRecord.first_name || "Amrita",
                    Last_Name: patientRecord.last_name || "Nair",
                    Gender: patientRecord.gender || "Female",
                    Age: patientRecord.age || 25,
                    Disease: patientRecord.disease || "Influenza",
                    Fever: "Yes",
                    Cough: "Yes",
                    Fatigue: "Yes",
                    "Difficulty Breathing": "Yes",
                    "Blood Pressure": "Normal",
                    "Cholesterol Level": "Normal",
                    "Outcome Variable": "Positive"
                };
            }
        }

        const steps = [];
        let predicted_gender = patient.Gender.toLowerCase();
        
        const age = parseInt(patient.Age) || 30;
        let age_group;
        if (age <= 2) age_group = "0-2";
        else if (age <= 9) age_group = "3-9";
        else if (age <= 19) age_group = "10-19";
        else if (age <= 29) age_group = "20-29";
        else if (age <= 39) age_group = "30-39";
        else if (age <= 49) age_group = "40-49";
        else if (age <= 59) age_group = "50-59";
        else if (age <= 69) age_group = "60-69";
        else age_group = "more than 70";

        let verified = true;
        let verif_msg = "";
        if (forceVerifyFail) {
            predicted_gender = predicted_gender === "female" ? "male" : "female";
            verified = false;
            verif_msg = `Verification failed. Patient checks as ${predicted_gender} but database record indicates ${patient.Gender}.`;
        } else {
            verified = true;
            verif_msg = `Verification successful.\nPatient is: ${patient.First_Name} ${patient.Last_Name}\nwith ID: ${patient.Patient_ID}\nwho is verified as ${predicted_gender} in age group of ${age_group}. Proceeding to the Physician.`;
        }
        
        steps.push({
            "node": "front_desk_agent_node",
            "title": "Front Desk Agent Node",
            "status": verified ? "success" : "failed",
            "outputs": {
                "predicted_gender": predicted_gender,
                "predicted_age_group": age_group,
                "patient_verification": verif_msg,
                "verified": verified
            },
            "logs": [
                "Front Desk Agent activated.",
                "Loading Face ID credentials from FaceID/image1.png...",
                "Running rizvandwiki/gender-classification pipeline...",
                `ViT Gender classification output: ${predicted_gender}`,
                "Running nateraw/vit-age-classifier pipeline...",
                `ViT Age classification output: ${age_group}`,
                "Querying medical database records...",
                `Database comparison status: ${verified ? 'MATCH FOUND' : 'NO RECORD MATCH'}`,
                verif_msg
            ]
        });

        if (!verified) {
            return {
                "patient": patient,
                "verified": false,
                "steps": steps,
                "final_status": "Verification Failed"
            };
        }

        const symptom_questions = {
            'Cough': "Are you having any cough?",
            'Fatigue': "Are you having any Fatigue?",
            'Difficulty Breathing': "Are you experiencing any difficulty while breathing?"
        };
        
        const conversation_logs = [];
        const symptom_summary_items = [];
        
        for (const [symptom, question] of Object.entries(symptom_questions)) {
            const has_symptom = patient[symptom] === "Yes";
            const answer = has_symptom ? "Yes" : "No";
            conversation_logs.push(`Physician: ${question}`);
            conversation_logs.push(`Patient: ${answer}`);
            
            if (has_symptom) {
                symptom_summary_items.push(`You are experiencing ${symptom.toLowerCase()}`);
            } else {
                symptom_summary_items.push(`I'm glad you are not experiencing any ${symptom.toLowerCase()}`);
            }
        }

        const physician_summary = `You are ${patient.First_Name} ${patient.Last_Name}, a ${patient.Age} years old ${patient.Gender} with Patient ID: ${patient.Patient_ID}.\nI gathered that:\n` + symptom_summary_items.join(" ; ") + ".";
        
        steps.push({
            "node": "physician_consultation_node",
            "title": "Physician Agent Node (Consultation)",
            "status": "success",
            "outputs": {
                "conversation": conversation_logs.join("\n"),
                "summary": physician_summary
            },
            "logs": [
                "Physician Agent Consultation activated.",
                "Screening patient for respiratory and systemic symptoms...",
                ...conversation_logs,
                "Synthesizing anamnesis clinical records...",
                physician_summary
            ]
        });

        const fever = patient.Fever || "Unknown";
        const bp = patient["Blood Pressure"] || "Unknown";
        const chol = patient["Cholesterol Level"] || "Unknown";
        const exam_summary = `Examination Results: Fever: ${fever}, Blood Pressure: ${bp} and Cholesterol level: ${chol}`;
        
        steps.push({
            "node": "physician_examination_node",
            "title": "Physician Agent Node (Examination)",
            "status": "success",
            "outputs": {
                "fever": fever,
                "blood_pressure": bp,
                "cholesterol_level": chol,
                "examination_patient": exam_summary
            },
            "logs": [
                "Physician Agent Physical Examination activated.",
                "Measuring patient vitals and cardiovascular attributes...",
                `Vitals check completed - Fever: ${fever}, BP: ${bp}, Cholesterol: ${chol}.`,
                exam_summary
            ]
        });

        const disease = patient.Disease || "Unknown";
        const outcome = patient["Outcome Variable"] || "Unknown";
        const should_do_xray = (outcome === "Positive") || (patient["Difficulty Breathing"] === "Yes");
        const diagnosis_route = should_do_xray ? "Make X-ray for Chest" : "Rest to Recover";
        const diagnosis_desc = `Disease: ${disease} Outcome Variable: ${outcome} and Final diagnosis: ${diagnosis_route}`;
        
        steps.push({
            "node": "physician_diagnosis_node",
            "title": "Physician Agent Node (Diagnosis & Routing)",
            "status": "success",
            "outputs": {
                "disease": disease,
                "outcome_variable": outcome,
                "diagnosis_patient": diagnosis_desc,
                "diagnosis": diagnosis_route,
                "should_do_xray": should_do_xray
            },
            "logs": [
                "Physician Agent Clinical Diagnosis activated.",
                `Analyzing clinical correlation (Suspected Disease: ${disease}, Database Outcome Code: ${outcome}).`,
                `Applying routing rule condition: ${diagnosis_route}`,
                `Routing instruction: ${should_do_xray ? 'FORWARD TO RADIOLOGIST' : 'DISCHARGE PATIENT WITH REST RECOMMENDATION'}`
            ]
        });

        let radiologist_triggered = false;
        if (should_do_xray) {
            radiologist_triggered = true;
            const prediction = outcome === "Positive" ? "PNEUMONIA" : "NORMAL";
            steps.push({
                "node": "radiologist_agent_node",
                "title": "Radiologist Agent Node",
                "status": "success",
                "outputs": {
                    "prediction": prediction,
                    "scan_image": "chest_xray_placeholder.png"
                },
                "logs": [
                    "Radiologist Agent Node activated via conditional edge.",
                    "Loading Chest X-Ray scan image...",
                    "Running lxyuan/vit-xray-pneumonia-classification Vision Transformer pipeline...",
                    "Running image preprocessing (resize to 224x224, normalization)...",
                    `Classification model outcome: ${prediction}`,
                    `Diagnostic result finalized: Chest scan indicates status ${prediction}.`
                ]
            });
        }

        return {
            "patient": patient,
            "verified": true,
            "radiologist_triggered": radiologist_triggered,
            "steps": steps,
            "final_status": "Completed"
        };
    }
});

// Polyfill strip
if (!String.prototype.strip) {
    String.prototype.strip = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
}
