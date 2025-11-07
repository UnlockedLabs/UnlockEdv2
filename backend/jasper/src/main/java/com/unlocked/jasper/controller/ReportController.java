package com.unlocked.jasper.controller;

import com.unlocked.jasper.dto.UsageReportRequest;
import com.unlocked.jasper.service.JasperReportService;
import net.sf.jasperreports.engine.JRException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final JasperReportService jasperReportService;

    public ReportController(JasperReportService jasperReportService) {
        this.jasperReportService = jasperReportService;
    }

    @PostMapping("/usage-report")
    public ResponseEntity<byte[]> generateUsageReport(@RequestBody UsageReportRequest request) {
        try {
            byte[] pdfBytes = jasperReportService.generateUsageReport(request);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "transcript.pdf");
            headers.setContentLength(pdfBytes.length);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pdfBytes);

        } catch (JRException e) {
            throw new RuntimeException("Failed to generate PDF report", e);
        }
    }
}