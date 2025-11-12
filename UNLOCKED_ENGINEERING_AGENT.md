# UnlockEd Engineering Agent - Universal Development Workflow

## 🎯 **Purpose**
This agent provides a standardized, repeatable development workflow for any engineering task in the UnlockEd repository. It captures best practices, decision-making processes, and quality assurance procedures.

---

## 📋 **01 - Ticket Analysis Phase**

### **Initial Assessment:**
- [ ] Read and understand requirements and acceptance criteria
- [ ] Identify scope boundaries and deliverables
- [ ] Note technical constraints and dependencies
- [ ] Estimate complexity and potential risks
- [ ] Clarify ambiguous requirements with stakeholders

### **Questions to Answer:**
- What are the specific acceptance criteria?
- What are the technical requirements and constraints?
- What is the expected timeline and priority?
- Who are the stakeholders and what are their expectations?
- What are the integration points and dependencies?

### **Output:**
- Clear requirements breakdown
- Risk assessment with mitigation strategies
- Initial technical approach outline

---

## 🏗️ **02 - Technical Design Phase**

### **Architecture Planning:**
- [ ] Review existing codebase and patterns
- [ ] Identify affected components and systems
- [ ] Design technical solution approach
- [ ] Consider scalability and maintainability
- [ ] Plan integration with existing systems

### **Decision Documentation:**
- **Why this approach?** Rationale behind technical choices
- **Alternatives considered?** Other options and why they were rejected
- **Trade-offs made?** Benefits and costs of decisions
- **Future implications?** How this affects maintainability

### **Design Artifacts:**
- Technical architecture diagram
- Component interaction flow
- Data flow and dependencies
- Integration points and interfaces

---

## 🚀 **03 - Implementation Planning Phase**

### **Phase-Based Breakdown:**
- [ ] Break implementation into logical phases
- [ ] Create subtasks with clear deliverables
- [ ] Estimate effort per phase
- [ ] Identify dependencies between phases
- [ ] Define testing strategy per phase

### **Development Workflow:**
```
Phase 1: Infrastructure & Setup
Phase 2: Core Implementation  
Phase 3: Integration & Testing
Phase 4: Documentation & Deployment
```

### **Task Management:**
- Use feature branches with descriptive names
- Create pull requests for review
- Track progress with todo items
- Document blockers and solutions

---

## 🔧 **04 - Development Patterns Phase**

### **Code Standards:**
- [ ] Follow existing code conventions
- [ ] Use established patterns and libraries
- [ ] Write self-documenting code
- [ ] Include appropriate error handling
- [ ] Consider security implications

### **Testing Requirements:**
- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete workflows
- **Performance Tests**: Verify performance criteria

### **Quality Gates:**
- Code review by peer developer
- Automated test suite passing
- No security vulnerabilities
- Performance benchmarks met
- Documentation complete

---

## 🧪 **05 - Testing Strategy Phase**

### **Testing Pyramid:**
```
E2E Tests (10%)
├── Integration Tests (20%)
├── Unit Tests (70%)
```

### **Test Categories:**
- **Functional Tests**: Does it work as specified?
- **Performance Tests**: Does it meet performance requirements?
- **Security Tests**: Are there vulnerabilities?
- **Compatibility Tests**: Works across environments?
- **Regression Tests**: Did we break existing functionality?

### **Testing Environments:**
- **Local Development**: Initial development and unit testing
- **Docker Container**: Integration testing
- **Staging Environment**: Pre-production validation
- **Production Monitoring**: Post-deployment verification

---

## 🚢 **06 - Deployment Planning Phase**

### **Pre-Deployment Checklist:**
- [ ] All tests passing in all environments
- [ ] Documentation complete and reviewed
- [ ] Rollback plan documented
- [ ] Monitoring and alerting configured
- [ ] Team communication plan ready

### **Deployment Steps:**
1. **Infrastructure Preparation**: Ensure environment readiness
2. **Code Deployment**: Merge to target branch
3. **Service Deployment**: Deploy application changes
4. **Verification**: Confirm deployment success
5. **Monitoring**: Observe system behavior

### **Rollback Procedures:**
- Immediate rollback triggers
- Step-by-step rollback process
- Communication protocols
- Post-rollback verification

---

## 📚 **07 - Documentation Requirements Phase**

### **Required Documentation:**
- [ ] **Technical Documentation**: Architecture and design decisions
- [ ] **API Documentation**: Interface specifications
- [ ] **User Documentation**: Usage instructions
- [ ] **Deployment Guide**: Step-by-step deployment process
- [ ] **Troubleshooting Guide**: Common issues and solutions

### **Documentation Standards:**
- Clear, concise, and actionable
- Include examples and code snippets
- Maintain version compatibility notes
- Provide troubleshooting steps

---

## 🔍 **08 - Troubleshooting Guide Phase**

### **Common Issues:**
- **Build Failures**: Docker, compilation, dependency issues
- **Runtime Errors**: Application startup, configuration problems
- **Integration Issues**: API calls, database connections
- **Performance Problems**: Slow response times, memory issues

### **Debugging Workflow:**
1. **Issue Identification**: What exactly is failing?
2. **Root Cause Analysis**: Why is it failing?
3. **Solution Implementation**: How to fix it?
4. **Verification**: Did the fix work?
5. **Prevention**: How to avoid recurrence?

### **Debugging Tools:**
- Container logs and monitoring
- Database query analysis
- API request/response inspection
- Performance profiling tools

---

## 🎓 **09 - Knowledge Transfer Phase**

### **Team Onboarding:**
- [ ] Document project context and background
- [ ] Create getting-started guides
- [ ] Provide example workflows
- [ ] Include best practices and patterns

### **Maintainability:**
- Code should be readable by others
- Decisions should be documented
- Tests should be comprehensive
- Documentation should be current

---

## 📊 **10 - Success Metrics Phase**

### **Quality Metrics:**
- **Code Quality**: Maintainability, readability, test coverage
- **Performance**: Response times, resource usage, uptime
- **Reliability**: Error rates, failure points, recovery time
- **Security**: Vulnerability counts, compliance status

### **Delivery Metrics:**
- **Timeliness**: On-time delivery vs. estimates
- **Completeness**: All acceptance criteria met
- **Stakeholder Satisfaction**: Requirements met and expectations managed

---

## 🔄 **Continuous Improvement**

### **Post-Implementation Review:**
- What went well in the process?
- What challenges were encountered?
- How could the process be improved?
- What knowledge was gained?

### **Process Updates:**
- Update templates and checklists
- Document lessons learned
- Share improvements with team
- Refine future development workflows

---

## 📋 **Quick Reference Checklist**

### **Before Starting:**
- [ ] Requirements clearly understood
- [ ] Technical approach planned
- [ ] Development environment ready
- [ ] Timeline and scope confirmed

### **During Development:**
- [ ] Following established patterns
- [ ] Writing tests alongside code
- [ ] Documenting decisions
- [ ] Communicating progress

### **Before Commit:**
- [ ] Code compiles and runs
- [ ] Tests are passing
- [ ] No security vulnerabilities
- [ ] Application is in stable state
- [ ] Documentation is updated

### **Before Deployment:**
- [ ] All environments tested
- [ ] Documentation reviewed
- [ ] Rollback plan ready
- [ ] Stakeholders notified

---

## 🎯 **Agent Usage Instructions**

1. **Copy this file** for any new development task
2. **Customize sections** based on specific project requirements
3. **Follow phases sequentially** for systematic development
4. **Update checklists** as tasks are completed
5. **Document learnings** for continuous improvement

### **Adaptation Guidelines:**
- Modify phases based on project complexity
- Add technology-specific sections as needed
- Adjust timelines based on team capacity
- Customize acceptance criteria for each project

---

**This agent serves as your comprehensive development companion, ensuring consistent, high-quality delivery across all UnlockEd engineering projects.**
