"""Pydantic input schemas for LangChain SQL agent tools (args_schema)."""

from typing import List

from pydantic import BaseModel, Field


class ListTablesInputSchema(BaseModel):
    tool_input: str = Field(default="", description="An empty string")


class GetTableSchemaInputSchema(BaseModel):
    table_names: List[str] = Field(
        ...,
        description="Table names to fetch schema for (from list_tables).",
    )


class QueryCheckerInputSchema(BaseModel):
    query: str = Field(..., description="The PostgreSQL SELECT query to validate or fix.")


class ExecuteQueryInputSchema(BaseModel):
    query: str = Field(
        ...,
        description="The SQL to run (typically the string returned by query_checker).",
    )


class GetCurrentDateInputSchema(BaseModel):
    tool_input: str = Field(default="", description="An empty string")
