import React from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SearchInputProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = "Tìm kiếm...", style }) => {
    return (
        <Input
            placeholder={placeholder}
            allowClear
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            style={{
                ...style
            }}
            prefix={<SearchOutlined style={{ color: '#eb2f96', fontSize: 18, marginRight: 8 }} />}
            className="cinematic-search"
        />
    );
};

export default SearchInput;
