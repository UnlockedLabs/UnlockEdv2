package com.unlocked.jasper.dto;

import java.util.List;

public class UsageReportRequest {
    private UserInfo user;
    private double totalMinutes;
    private long totalResources;
    private List<ProgramInfo> programs;

    public static class UserInfo {
        private String nameFirst;
        private String nameLast;
        private String docId;
        private String facilityName;
        private String createdAt;
        private int totalLogins;

        public String getNameFirst() { return nameFirst; }
        public void setNameFirst(String nameFirst) { this.nameFirst = nameFirst; }
        public String getNameLast() { return nameLast; }
        public void setNameLast(String nameLast) { this.nameLast = nameLast; }
        public String getDocId() { return docId; }
        public void setDocId(String docId) { this.docId = docId; }
        public String getFacilityName() { return facilityName; }
        public void setFacilityName(String facilityName) { this.facilityName = facilityName; }
        public String getCreatedAt() { return createdAt; }
        public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
        public int getTotalLogins() { return totalLogins; }
        public void setTotalLogins(int totalLogins) { this.totalLogins = totalLogins; }
    }

    public static class ProgramInfo {
        private String programName;
        private String className;
        private String status;
        private String attendancePercentage;
        private String startDate;
        private String endDate;

        public String getProgramName() { return programName; }
        public void setProgramName(String programName) { this.programName = programName; }
        public String getClassName() { return className; }
        public void setClassName(String className) { this.className = className; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getAttendancePercentage() { return attendancePercentage; }
        public void setAttendancePercentage(String attendancePercentage) { this.attendancePercentage = attendancePercentage; }
        public String getStartDate() { return startDate; }
        public void setStartDate(String startDate) { this.startDate = startDate; }
        public String getEndDate() { return endDate; }
        public void setEndDate(String endDate) { this.endDate = endDate; }
    }

    public UserInfo getUser() { return user; }
    public void setUser(UserInfo user) { this.user = user; }
    public double getTotalMinutes() { return totalMinutes; }
    public void setTotalMinutes(double totalMinutes) { this.totalMinutes = totalMinutes; }
    public long getTotalResources() { return totalResources; }
    public void setTotalResources(long totalResources) { this.totalResources = totalResources; }
    public List<ProgramInfo> getPrograms() { return programs; }
    public void setPrograms(List<ProgramInfo> programs) { this.programs = programs; }
}