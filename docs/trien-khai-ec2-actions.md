# Chạy deploy EC2 từ GitHub Actions

Workflow **Deploy UniSwap trên EC2** chạy khi người vận hành bấm **Run workflow** và chọn nhánh `main`. GitHub xác thực với AWS qua OIDC, gọi Systems Manager chạy `scripts/deploy.sh` bằng tài khoản `ec2-user` và chờ kết quả. Script lấy `main` mới nhất tại thời điểm chạy trên EC2, ghi commit thực tế và báo lỗi nếu smoke test thất bại.

## 1. Kết nối EC2 với Systems Manager

- Trên EC2 đã thiết lập UniSwap, xác nhận repo nằm ở `/home/ec2-user/UniSwap`, nhánh `main` sạch và chạy tay được `bash scripts/deploy.sh`.
- Gắn cho EC2 một IAM role có policy `AmazonSSMManagedInstanceCore`. Nếu máy đã có role, thêm policy vào role đang dùng.
- Trong AWS Systems Manager, kiểm tra EC2 xuất hiện trong **Managed nodes** với trạng thái **Online**. [Hướng dẫn thiết lập managed node](https://docs.aws.amazon.com/systems-manager/latest/userguide/managed_instances.html)
- Ở cùng region với EC2, vào **Systems Manager → Documents → Create command or session**. Chọn loại **Command**, đặt tên `UniSwap-Deploy`, chọn YAML và dùng nội dung từ [mẫu SSM](../deploy/ssm/uniswap-deploy.yaml). Tài liệu này chỉ gọi script deploy đã có trên EC2.

## 2. Tạo IAM role cho GitHub

Trong IAM, tạo hoặc dùng lại OIDC provider `https://token.actions.githubusercontent.com` với audience `sts.amazonaws.com`. Tạo một IAM role dành riêng cho workflow deploy. Trong trust policy, thay `ACCOUNT_ID` bằng ID tài khoản AWS của bạn.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:HBX-HCMUT@361025184/UniSwap@1469726205:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

Giá trị `sub` dùng ID cố định của tổ chức và repo theo định dạng OIDC hiện tại của GitHub. Role chỉ nhận workflow từ nhánh `main` của UniSwap. [Định dạng OIDC của GitHub](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims)

Thêm permissions policy sau vào role. Thay `REGION`, `ACCOUNT_ID` và `INSTANCE_ID` bằng thông tin của EC2. Quyền chạy lệnh giới hạn ở tài liệu `UniSwap-Deploy` và đúng EC2 này. Quyền đọc kết quả SSM giới hạn theo region.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:REGION:ACCOUNT_ID:document/UniSwap-Deploy",
        "arn:aws:ec2:REGION:ACCOUNT_ID:instance/INSTANCE_ID"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "REGION"
        }
      }
    }
  ]
}
```

## 3. Đặt biến và chạy deploy

Trong repo GitHub, vào **Settings → Secrets and variables → Actions → Variables** và thêm:

| Biến | Giá trị |
|---|---|
| `EC2_DEPLOY_REGION` | Region của EC2 |
| `EC2_DEPLOY_INSTANCE_ID` | Instance ID của EC2 |
| `EC2_DEPLOY_ROLE_ARN` | ARN của IAM role dành cho GitHub |

Sau khi [workflow](../.github/workflows/deploy-ec2.yml) vào `main`, vào **Actions → Deploy UniSwap trên EC2 → Run workflow**, chọn `main` và bấm chạy. Mở log của lượt chạy để xem commit được deploy và dòng **Smoke test thành công**. Khi job báo lỗi, dùng SSM command ID trong log để xem chi tiết trên AWS Systems Manager.
