package com.unlocked.jasper.service;

import com.unlocked.jasper.dto.UsageReportRequest;
import net.sf.jasperreports.engine.*;
import net.sf.jasperreports.engine.data.JRBeanCollectionDataSource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
public class JasperReportService {

    public byte[] generateUsageReport(UsageReportRequest request) throws JRException {
        InputStream reportTemplate = getClass().getResourceAsStream("/templates/usage_report.jrxml");
        if (reportTemplate == null) {
            throw new RuntimeException("Template not found: usage_report.jrxml");
        }

        JasperReport jasperReport = JasperCompileManager.compileReport(reportTemplate);

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("residentName", request.getUser().getNameFirst() + " " + request.getUser().getNameLast());
        parameters.put("residentId", request.getUser().getDocId());
        parameters.put("facilityName", request.getUser().getFacilityName());
        parameters.put("generatedDate", java.time.LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")));
        parameters.put("dateRange", request.getUser().getCreatedAt() + " - present");
        parameters.put("totalTime", formatDuration(request.getTotalMinutes()));
        parameters.put("totalLogins", String.valueOf(request.getUser().getTotalLogins()));
        parameters.put("totalResources", String.valueOf(request.getTotalResources()));
        parameters.put("showPrograms", !request.getPrograms().isEmpty());

        JRBeanCollectionDataSource programsDataSource = new JRBeanCollectionDataSource(request.getPrograms());

        JasperPrint jasperPrint = JasperFillManager.fillReport(jasperReport, parameters, programsDataSource);

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        JasperExportManager.exportReportToPdfStream(jasperPrint, outputStream);

        return outputStream.toByteArray();
    }

    private String formatDuration(double minutes) {
        if (minutes <= 0) {
            return "none";
        }

        long totalMinutes = (long) minutes;
        long hours = totalMinutes / 60;
        long mins = totalMinutes % 60;

        if (hours > 0) {
            return String.format("%d hour%s %d minute%s", hours, hours == 1 ? "" : "s", mins, mins == 1 ? "" : "s");
        } else {
            return String.format("%d minute%s", mins, mins == 1 ? "" : "s");
        }
    }
}