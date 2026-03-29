# Writing Feedback System --- Requirements Specification

## 1. Overview

This document defines the system requirements for a writing feedback
system built on top of HelpMe.

------------------------------------------------------------------------

## 2. User Workflow

User uploads essay file (.docx / .pdf / .txt) → Text extraction → LLM (+
optional RAG) → JSON output → Frontend rendering

------------------------------------------------------------------------

## 1. File Handling Module

  ID        Requirement                      Verification
  --------- -------------------------------- ----------------
  R-FH-01   Accept .docx, .pdf, .txt files   Upload test
  R-FH-02   Reject unsupported formats       Upload .jpg
  R-FH-03   Extract text from files          Compare output

------------------------------------------------------------------------

## 2. Input Validation Module

  ID        Requirement          Verification
  --------- -------------------- -------------------
  R-IV-01   Reject empty files   Upload empty file
  R-IV-02   Reject large files   Upload large file

------------------------------------------------------------------------

## 3. Structured Output Module

  ID        Requirement         Verification
  --------- ------------------- -------------------
  R-SO-01   Output valid JSON   JSON parser
  R-SO-02   Follow schema       Schema validation

------------------------------------------------------------------------

## 4. Non-Functional Requirements

  ID        Requirement            Verification
  --------- ---------------------- -----------------
  R-NF-01   Response time \< 10s   Measure latency
  R-NF-02   Modular design         Code review
