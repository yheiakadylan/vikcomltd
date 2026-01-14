export const translations = {
    en: {
        common: {
            urgent: 'Urgent',
            normal: 'Normal',
            on: 'ON',
            off: 'OFF',
            cancel: 'Cancel',
            delete: 'Delete',
            save: 'Save',
            edit: 'Edit',
            view: 'View',
            uploading: 'Uploading...',
            success: 'Success',
            error: 'Error',
            loading: 'Loading...'
        },
        header: {
            newTask: 'Create Task',
            profile: 'Profile',
            logout: 'Logout',
            dashboard: 'Dashboard',
            admin: 'Admin Page',
            role: {
                cs: 'Customer Service',
                ds: 'Designer',
                admin: 'Administrator'
            }
        },
        dashboard: {
            tabs: {
                new: 'New',
                doing: 'Doing',
                in_review: 'In Review',
                need_fix: 'Need Fix',
                done: 'Done'
            },
            searchPlaceholder: 'Search Order ID...',
            pagination: {
                of: 'of',
                items: 'items'
            },
            card: {
                noImage: 'No Image',
                noDesc: 'No description',
                confirmDelete: 'Delete this task?',
                giveBack: 'Return',
                imageText: 'Img'
            },
            empty: 'No Data',
            messages: {
                deleteSuccess: 'Task deleted successfully.',
                deleteError: 'Error deleting task.',
                noPermission: 'Permission denied.',
                noOrderFound: 'Order not found'
            }
        },
        newTask: {
            title: 'Create New Task',
            urgentQuestion: 'Urgent?',
            form: {
                mockup: 'Mockup Image (Required)',
                mockupUpload: 'Upload Mockup',
                mockupHint: 'Drag & Drop or Click to select',
                orderId: 'Order ID',
                taskId: 'Task Title (Optional)',
                sku: 'SKU (if any)',
                desc: 'Description',
                customerFiles: 'Customer Files (Optional)',
                clickToUpload: 'Click or Drag & Drop multiple images',
                waitingUpload: 'Files will be uploaded upon creation',
                staged: 'Files waiting for upload',
                submit: 'Create Task'
            }
        },
        taskDetail: {
            header: {
                urgent: 'URGENT 🔥',
                normal: 'Normal',
                urgentOn: 'Urgent Mode ON',
                urgentOff: 'Urgent Mode OFF'
            },
            tabs: {
                details: 'Task Details',
                activities: 'Activities'
            },
            info: {
                creator: 'Creator',
                designer: 'Designer',
                update: 'Update Task'
            },
            form: {
                title: 'Title',
                sku: 'SKU',
                desc: 'Description'
            },
            mockup: {
                title: 'MOCKUP',
                noMockup: 'No Mockup'
            },
            customerFiles: {
                title: 'Customer Files',
                downloadView: 'Download / View',
                noFiles: 'No files yet.'
            },
            designFiles: {
                title: 'DESIGN FILES',
                dragDrop: 'Drag & drop or click to select files',
                staged: 'Files waiting for upload',
                noFiles: 'No files yet.'
            },
            actions: {
                claim: 'CLAIM TASK',
                requestFix: 'Request Fix',
                approve: 'APPROVE',
                submit: 'SUBMIT',
                claimSuccess: 'Claimed Successfully'
            },
            activities: {
                empty: 'No activities yet',
                placeholder: 'Enter comment...',
                send: 'Send'
            }
        },
        notifications: {
            uploadSuccess: {
                message: 'Submitted: Order #',
                description: 'Upload complete. Order status changed to In Review.'
            },
            uploadError: {
                message: 'Auto-Submit Failed: Order #',
                description: 'Please check the order.'
            },
            createTaskSuccess: {
                message: 'Task Created: Order #',
                description: 'Files uploaded to Dropbox successfully.'
            },
            uploadComplete: {
                message: 'Upload Complete: Order #',
                description: 'All files uploaded successfully.'
            }
        },
        widget: {
            uploading: 'Uploading',
            completed: 'Uploads Completed',
            uploadComplete: 'Upload Complete',
            files: 'files',
            clear: 'Clear All',
            minimized: {
                uploading: 'Uploading',
                completed: 'Upload Complete'
            }
        },
        autoFill: {
            found: 'Found order data.',
            confirmFill: 'Auto-fill data?',
            selectItem: 'Select an item to fill',
            fillSuccess: 'Data auto-filled!',
            fetchError: 'Could not fetch order data',
            imageError: 'Could not auto-download Mockup (CORS blocked). Please upload manually.',
            filling: 'Auto-filling...',
            fetching: 'Fetching order data...',
            notFound: 'Order not found',
            serverError: 'Server connection error'
        }
    },
    vi: {
        common: {
            urgent: 'GẤP',
            normal: 'Thường',
            on: 'BẬT',
            off: 'TẮT',
            cancel: 'Hủy bỏ',
            delete: 'Xóa',
            save: 'Lưu',
            edit: 'Sửa',
            view: 'Xem',
            uploading: 'Đang tải lên...',
            success: 'Thành công',
            error: 'Lỗi',
            loading: 'Đang tải...'
        },
        header: {
            newTask: 'Tạo Task',
            profile: 'Thông tin cá nhân',
            logout: 'Đăng xuất',
            dashboard: 'Về Dashboard',
            admin: 'Trang Admin',
            role: {
                cs: 'Chăm sóc khách hàng',
                ds: 'Designer',
                admin: 'Quản trị viên'
            }
        },
        dashboard: {
            tabs: {
                new: 'Mới',
                doing: 'Đang làm',
                in_review: 'Chờ duyệt',
                need_fix: 'Cần sửa',
                done: 'Hoàn thành'
            },
            searchPlaceholder: 'Tìm Order ID...',
            pagination: {
                of: 'của',
                items: 'mục'
            },
            card: {
                noImage: 'Không ảnh',
                noDesc: 'Không có mô tả',
                confirmDelete: 'Xóa task này?',
                giveBack: 'Trả đơn',
                imageText: 'Ảnh'
            },
            empty: 'Trống',
            messages: {
                deleteSuccess: 'Đã xóa task.',
                deleteError: 'Lỗi khi xóa task.',
                noPermission: 'Không có quyền truy cập.',
                noOrderFound: 'Không tìm thấy đơn hàng'
            }
        },
        newTask: {
            title: 'Tạo Task Mới',
            urgentQuestion: 'Gấp?',
            form: {
                mockup: 'Ảnh Mockup (Bắt buộc)',
                mockupUpload: 'Tải ảnh Mockup',
                mockupHint: 'Kéo thả hoặc Click để chọn',
                orderId: 'Mã Đơn Hàng (Order ID)',
                taskId: 'Tiêu đề Task',
                sku: 'Mã SKU (nếu có)',
                desc: 'Mô tả chi tiết',
                customerFiles: 'Ảnh khách gửi (Tùy chọn)',
                clickToUpload: 'Click hoặc Kéo thả nhiều ảnh vào đây',
                waitingUpload: 'File sẽ chờ upload khi bấm "Tạo Task"',
                staged: 'File chờ upload',
                submit: 'Tạo Task'
            }
        },
        taskDetail: {
            header: {
                urgent: 'GẤP 🔥',
                normal: 'Thường',
                urgentOn: 'Đã bật chế độ GẤP 🔥',
                urgentOff: 'Đã tắt chế độ Gấp'
            },
            tabs: {
                details: 'Chi tiết Task',
                activities: 'Hoạt động'
            },
            info: {
                creator: 'Người tạo',
                designer: 'Designer',
                update: 'Cập nhật Task'
            },
            form: {
                title: 'Tiêu đề Task',
                sku: 'SKU',
                desc: 'Mô tả chi tiết'
            },
            mockup: {
                title: 'ẢNH MOCKUP',
                noMockup: 'Không có Mockup'
            },
            customerFiles: {
                title: 'File đính kèm',
                downloadView: 'Tải xuống / Xem',
                noFiles: 'Không có file đính kèm'
            },
            designFiles: {
                title: 'FILE THIẾT KẾ',
                dragDrop: 'Kéo thả hoặc click để chọn file',
                staged: 'File chờ upload',
                noFiles: 'Chưa có file.'
            },
            actions: {
                claim: 'NHẬN TASK',
                requestFix: 'Yêu cầu sửa',
                approve: 'DUYỆT',
                submit: 'GỬI DUYỆT',
                claimSuccess: 'Đã nhận Task'
            },
            activities: {
                empty: 'Chưa có hoạt động nào',
                placeholder: 'Nhập trao đổi...',
                send: 'Gửi'
            }
        },
        notifications: {
            uploadSuccess: {
                message: 'Đã gửi lên: Đơn #',
                description: 'Upload hoàn tất. Đơn đã chuyển sang trạng thái chờ duyệt.'
            },
            uploadError: {
                message: 'Lỗi tải lên tự động: Đơn #',
                description: 'Vui lòng kiểm tra lại đơn hàng.'
            },
            createTaskSuccess: {
                message: 'Tạo Task hoàn tất: Đơn #',
                description: 'Các file đính kèm đã được tải lên Dropbox thành công.'
            },
            uploadComplete: {
                message: 'Upload hoàn tất: Đơn #',
                description: 'Tất cả file đã được tải lên thành công.'
            }
        },
        widget: {
            uploading: 'Đang tải lên',
            completed: 'Upload hoàn tất',
            uploadComplete: 'Upload xong',
            files: 'file',
            clear: 'Xóa tất cả',
            minimized: {
                uploading: 'Đang tải',
                completed: 'Đã xong'
            }
        },
        autoFill: {
            found: 'Tìm thấy dữ liệu đơn hàng.',
            confirmFill: 'Tự động điền dữ liệu?',
            selectItem: 'Chọn sản phẩm để điền',
            fillSuccess: 'Đã điền dữ liệu!',
            fetchError: 'Không thể lấy dữ liệu đơn hàng',
            imageError: 'Không thể tải ảnh Mockup (bị chặn). Vui lòng tải thủ công.',
            filling: 'Đang điền...',
            fetching: 'Đang tìm thông tin đơn hàng...',
            notFound: 'Không tìm thấy đơn hàng',
            serverError: 'Lỗi kết nối server'
        }
    }
};


export type Language = 'en' | 'vi';
