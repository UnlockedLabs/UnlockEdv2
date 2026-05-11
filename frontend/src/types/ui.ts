import { ReactNode } from 'react';

export enum ModalType {
    Edit = 'Edit',
    Add = 'Add',
    Show = 'Show',
    Associate = 'Associate',
    Confirm = 'Confirm',
    Register = 'Register',
    Blank = '',
    Delete = 'Delete'
}

export interface ModalProps {
    type: ModalType | string;
    item: string;
    form: ReactNode | undefined;
}

export enum ToastState {
    success = 'success',
    error = 'error',
    null = ''
}

export enum ViewType {
    Grid = 'Grid',
    List = 'List'
}

export enum PillTagType {
    Open = 'open_enrollment',
    Permission = 'fixed_enrollment',
    SelfPaced = 'open_content'
}

export enum OutcomePillType {
    Certificate = 'certificate',
    CollegeCredit = 'college_credit'
}

export interface Tab {
    name: string;
    value: string | number;
}

export type Link = Record<string, string>;

export interface Option {
    key: number;
    value: string;
}

export interface YAxisTickProps {
    x: number;
    y: number;
    payload: {
        value: string;
    };
}

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export type ErrorType = 'unauthorized' | 'not-found' | 'server-error';
