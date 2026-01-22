import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SearchInputProps {
    value?: string;
    onChange?: (value: string) => void;
    onSearch?: (value: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
    className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value = '', onChange, onSearch, placeholder = "Tìm kiếm...", style, className }) => {
    // Internal state for performance (avoid parent re-render on every keystroke)
    const [internalValue, setInternalValue] = useState(value);

    // Sync with external value (e.g. from URL)
    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInternalValue(val);
        // Only trigger onChange if it's a clear action (empty) or if parent really needs it
        // We always pass it to support generic use, but optimized parent will ignore high-frequency updates.
        if (onChange) onChange(val);
    };

    return (
        <Input
            placeholder={placeholder}
            allowClear
            value={internalValue}
            onChange={handleChange}
            onPressEnter={(e) => onSearch?.(e.currentTarget.value)}
            style={{
                ...style
            }}
            prefix={<SearchOutlined style={{ color: 'var(--primary-color)', fontSize: 18, marginRight: 8 }} />}
            className={`cinematic-search ${className || ''}`}
        />
    );
};

export default SearchInput;
